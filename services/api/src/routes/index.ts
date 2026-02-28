import crypto from "crypto";
import { NextFunction, Request, Response, Router } from "express";

import { AuditChain } from "../audit/chain";
import { MLClient } from "../clients/mlClient";
import { ApiStore } from "../store/store";
import { IngestPayload, InteractionType, MetadataEvent } from "../types";
import { hashAlias } from "../utils/hash";

const ALLOWED_INTERACTIONS: InteractionType[] = [
  "text",
  "call",
  "ignored_message",
  "auto_nudge",
  "missed_call",
];

function clampSentiment(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function sanitizeMetadata(input: unknown): Record<string, unknown> {
  const source = typeof input === "object" && input !== null ? { ...(input as Record<string, unknown>) } : {};

  delete source.raw_message;
  delete source.message_text;
  delete source.full_text;
  delete source.chat_text;

  return source;
}

function normalizeEvents(rawEvents: Partial<MetadataEvent>[], contactHash: string): MetadataEvent[] {
  return rawEvents.map((event, idx) => {
    const interaction = ALLOWED_INTERACTIONS.includes(
      event.interaction_type as InteractionType,
    )
      ? (event.interaction_type as InteractionType)
      : "text";

    return {
      event_id:
        typeof event.event_id === "string" && event.event_id.length > 2
          ? event.event_id
          : `evt_${contactHash}_${Date.now()}_${idx}`,
      contact_hash: contactHash,
      ts: typeof event.ts === "string" ? event.ts : new Date().toISOString(),
      interaction_type: interaction,
      sentiment: clampSentiment(Number(event.sentiment ?? 0)),
      intent: typeof event.intent === "string" ? event.intent : "check_in",
      summary:
        typeof event.summary === "string" && event.summary.length >= 8
          ? event.summary.slice(0, 280)
          : "Synthetic interaction summary.",
      metadata: sanitizeMetadata(event.metadata),
    };
  });
}

function buildDraft(alias: string, recommendation: string): string {
  return `Hey ${alias}, quick check-in from bubbleOne. ${recommendation}`;
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function buildRouter(store: ApiStore, mlClient: MLClient, audit: AuditChain): Router {
  const router = Router();

  router.get("/health", asyncRoute(async (_req, res) => {
    const mlHealth = await mlClient.health().catch(() => ({ status: "ml_unreachable" }));
    res.json({ status: "ok", ml: mlHealth });
  }));

  router.post("/api/ingest", asyncRoute(async (req, res) => {
    const body = req.body as IngestPayload;

    if (!body?.alias || !Array.isArray(body.events) || body.events.length === 0) {
      res.status(400).json({ error: "alias and non-empty events[] are required" });
      return;
    }

    const contactHash = body.contact_hash ?? hashAlias(body.alias);
    const events = normalizeEvents(body.events, contactHash);

    store.appendEvents(contactHash, body.alias, events);

    const previousScore = store.getContact(contactHash)?.currentScore ?? 50;
    let mlOutcome;
    try {
      mlOutcome = await mlClient.processContact({
        contact_hash: contactHash,
        alias: body.alias,
        events,
        previous_score: previousScore,
      });
    } catch (error) {
      res.status(502).json({
        error: "ml_service_unavailable",
        message: error instanceof Error ? error.message : "ML processing failed",
      });
      return;
    }

    const updatedContact = store.applyMLOutcome(contactHash, body.alias, mlOutcome);

    const action = store.addAction({
      id: crypto.randomUUID(),
      contactHash,
      alias: body.alias,
      type: mlOutcome.action_type,
      text: mlOutcome.recommended_action,
      status: "pending",
      scheduledFor: mlOutcome.schedule_at,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    audit.append("ingest", {
      contactHash,
      alias: body.alias,
      eventsInserted: events.length,
      actionId: action.id,
    });

    res.json({
      contact: updatedContact,
      created_action: action,
    });
  }));

  router.get("/api/dashboard", (_req, res) => {
    const contacts = store.listContacts();
    const pendingActions = store.listActions("pending");

    const metrics = {
      contacts: contacts.length,
      avgScore:
        contacts.length > 0
          ? Number(
              (
                contacts.reduce((sum, contact) => sum + contact.currentScore, 0) /
                contacts.length
              ).toFixed(2),
            )
          : 0,
      criticalCount: contacts.filter((c) => c.band === "critical").length,
      pendingActions: pendingActions.length,
    };

    res.json({ contacts, actions: pendingActions, metrics });
  });

  router.post("/api/actions/draft", (req, res) => {
    const { contactHash } = req.body as { contactHash?: string };
    if (!contactHash) {
      return res.status(400).json({ error: "contactHash is required" });
    }

    const contact = store.getContact(contactHash);
    if (!contact) {
      return res.status(404).json({ error: "contact not found" });
    }

    const text = buildDraft(contact.alias, contact.recommendation);
    const action = store.addAction({
      id: crypto.randomUUID(),
      contactHash,
      alias: contact.alias,
      type: "draft",
      text,
      status: "pending",
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    audit.append("draft_created", { contactHash, actionId: action.id });
    return res.json({ draft: text, action });
  });

  router.post("/api/actions/send", (req, res) => {
    const { actionId } = req.body as { actionId?: string };
    if (!actionId) {
      return res.status(400).json({ error: "actionId is required" });
    }

    const action = store.completeAction(actionId);
    if (!action) {
      return res.status(404).json({ error: "action not found" });
    }

    audit.append("action_completed", { actionId });
    return res.json({ sent: true, action });
  });

  router.post("/api/actions/auto-nudge", (req, res) => {
    const { contactHash, enabled } = req.body as {
      contactHash?: string;
      enabled?: boolean;
    };

    if (!contactHash) {
      return res.status(400).json({ error: "contactHash is required" });
    }

    const contact = store.setAutoNudge(contactHash, enabled ?? true);
    if (!contact) {
      return res.status(404).json({ error: "contact not found" });
    }

    const action = store.addAction({
      id: crypto.randomUUID(),
      contactHash,
      alias: contact.alias,
      type: "reminder",
      text: `Auto-nudge enabled for ${contact.alias}. Scheduled follow-up will be generated automatically.`,
      status: "pending",
      scheduledFor: contact.scheduleAt,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    audit.append("auto_nudge_toggled", { contactHash, enabled: contact.autoNudgeEnabled });
    return res.json({ contact, action });
  });

  router.get("/api/audit/chain", (_req, res) => {
    res.json({ valid: audit.verify(), chain: audit.getChain() });
  });

  return router;
}
