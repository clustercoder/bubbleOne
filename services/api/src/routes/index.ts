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

function fallbackDraft(alias: string): string {
  return `Hey ${alias}, just checking in. Hope your week is going okay.`;
}

function textForAction(actionType: string, recommendation: string, draftMessage: string): string {
  if (actionType === "draft" || actionType === "draft_and_schedule") {
    return draftMessage || recommendation;
  }
  return recommendation;
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
    const contactBeforeIngest = store.getContact(contactHash);

    store.appendEvents(contactHash, body.alias, events);
    const contactAfterIngest = store.getContact(contactHash);
    const counts = store.getInteractionCounts(contactHash, 7);
    const modelEvents = store.getRecentEvents(contactHash, 40);

    const previousScore = contactBeforeIngest?.currentScore ?? 50;
    let mlOutcome;
    try {
      mlOutcome = await mlClient.processContact({
        contact_hash: contactHash,
        alias: body.alias,
        events: modelEvents,
        previous_score: previousScore,
        interaction_multiplier: contactAfterIngest?.tuning.interactionMultiplier ?? 1.0,
        lambda_decay_override: contactAfterIngest?.tuning.lambdaDecay ?? 0.08,
        recent_event_count_7d: counts.recent,
        prior_event_count_7d: counts.prior,
        temporal_training_enabled: true,
      });
    } catch (error) {
      res.status(502).json({
        error: "ml_service_unavailable",
        message: error instanceof Error ? error.message : "ML processing failed",
      });
      return;
    }

    const updatedContact = store.applyMLOutcome(contactHash, body.alias, mlOutcome);

    let action = null;
    const hasPendingAuto = store.hasPendingAction(contactHash, {
      origin: "auto",
      types: [mlOutcome.action_type],
    });
    if (!hasPendingAuto) {
      action = store.addAction({
        id: crypto.randomUUID(),
        contactHash,
        alias: body.alias,
        type: mlOutcome.action_type,
        text: textForAction(
          mlOutcome.action_type,
          mlOutcome.recommended_action,
          mlOutcome.draft_message,
        ),
        status: "pending",
        origin: "auto",
        scheduledFor: mlOutcome.schedule_at,
        createdAt: new Date().toISOString(),
        completedAt: null,
        ignoredAt: null,
      });
    }

    audit.append("ingest", {
      contactHash,
      alias: body.alias,
      eventsInserted: events.length,
      actionId: action?.id ?? null,
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

    res.json({ contacts, actions: pendingActions, metrics, meta: store.getMeta() });
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

    const text = contact.draftMessage?.trim() || fallbackDraft(contact.alias);
    const action = store.addAction({
      id: crypto.randomUUID(),
      contactHash,
      alias: contact.alias,
      type: "draft",
      text,
      status: "pending",
      origin: "user",
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: null,
      ignoredAt: null,
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

    const feedbackApplied = action.type.includes("draft")
      ? store.applyFeedback(action.contactHash, true)
      : null;

    audit.append("action_completed", {
      actionId,
      contactHash: action.contactHash,
      feedbackApplied: Boolean(feedbackApplied),
    });
    return res.json({ sent: true, action });
  });

  router.post("/api/actions/ignore", (req, res) => {
    const { actionId } = req.body as { actionId?: string };
    if (!actionId) {
      return res.status(400).json({ error: "actionId is required" });
    }

    const action = store.ignoreAction(actionId);
    if (!action) {
      return res.status(404).json({ error: "action not found" });
    }

    const feedbackApplied = action.type.includes("draft")
      ? store.applyFeedback(action.contactHash, false)
      : null;
    audit.append("action_ignored", {
      actionId,
      contactHash: action.contactHash,
      feedbackApplied: Boolean(feedbackApplied),
    });
    return res.json({ ignored: true, action });
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

    let action = null;
    if (contact.autoNudgeEnabled) {
      const hasPending = store.hasPendingAction(contactHash, { types: ["reminder"], origin: "auto" });
      if (!hasPending) {
        action = store.addAction({
          id: crypto.randomUUID(),
          contactHash,
          alias: contact.alias,
          type: "reminder",
          text: `Auto-nudge enabled for ${contact.alias}. bubbleOne will auto-schedule follow-ups.`,
          status: "pending",
          origin: "auto",
          scheduledFor: contact.scheduleAt,
          createdAt: new Date().toISOString(),
          completedAt: null,
          ignoredAt: null,
        });
      }
    }

    audit.append("auto_nudge_toggled", {
      contactHash,
      enabled: contact.autoNudgeEnabled,
      actionId: action?.id ?? null,
    });
    return res.json({ contact, action });
  });

  router.get("/api/audit/chain", (_req, res) => {
    res.json({ valid: audit.verify(), chain: audit.getChain() });
  });

  return router;
}
