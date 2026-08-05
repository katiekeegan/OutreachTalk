"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

function emptyState() {
  const now = Date.now();
  return {
    version: 1,
    exercise: {
      finalized: false,
      finalizedAt: null,
      updatedAt: now
    },
    submissions: []
  };
}

function normalizeState(value) {
  const fallback = emptyState();
  if (!value || typeof value !== "object") return fallback;
  const submissions = Array.isArray(value.submissions) ? value.submissions : [];
  return {
    version: 1,
    exercise: {
      finalized: Boolean(value.exercise?.finalized),
      finalizedAt: Number.isFinite(value.exercise?.finalizedAt) ? value.exercise.finalizedAt : null,
      updatedAt: Number.isFinite(value.exercise?.updatedAt) ? value.exercise.updatedAt : Date.now()
    },
    submissions: submissions
      .filter(item => item && typeof item === "object" && VALID_STATUSES.has(item.status))
      .map(item => ({
        id: String(item.id),
        participantId: String(item.participantId || "unknown"),
        text: String(item.text || "").slice(0, 240),
        status: item.status,
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now()
      }))
  };
}

class ExerciseStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.state = emptyState();
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.state = normalizeState(JSON.parse(await fs.readFile(this.filePath, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("State file could not be read; starting clean.", error.message);
      await this.persist();
    }
    return this;
  }

  snapshot() {
    return structuredClone(this.state);
  }

  publicSnapshot() {
    const approved = this.state.submissions
      .filter(item => item.status === "approved")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ id, text, createdAt, updatedAt }) => ({ id, text, createdAt, updatedAt, status: "approved" }));
    const counts = this.state.submissions.reduce((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0 });
    return {
      exercise: { ...this.state.exercise },
      approved,
      counts,
      updatedAt: this.state.exercise.updatedAt
    };
  }

  mine(participantId) {
    return this.state.submissions
      .filter(item => item.participantId === participantId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(item => ({ id: item.id, text: item.text, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt }));
  }

  moderatorSnapshot() {
    return {
      exercise: { ...this.state.exercise },
      submissions: [...this.state.submissions].sort((a, b) => b.createdAt - a.createdAt)
    };
  }

  async submit({ participantId, text }) {
    return this.mutate(state => {
      if (state.exercise.finalized) {
        const error = new Error("The exercise is finalized.");
        error.code = "EXERCISE_FINALIZED";
        throw error;
      }
      const now = Date.now();
      const submission = {
        id: crypto.randomUUID(),
        participantId,
        text,
        status: "pending",
        createdAt: now,
        updatedAt: now
      };
      state.submissions.push(submission);
      state.exercise.updatedAt = now;
      return { ...submission };
    });
  }

  async setStatus(id, status) {
    if (!VALID_STATUSES.has(status) || status === "pending") throw new Error("Invalid moderation status.");
    return this.mutate(state => {
      const submission = state.submissions.find(item => item.id === id);
      if (!submission) {
        const error = new Error("Submission not found.");
        error.code = "NOT_FOUND";
        throw error;
      }
      submission.status = status;
      submission.updatedAt = Date.now();
      state.exercise.updatedAt = submission.updatedAt;
      return { ...submission };
    });
  }

  async finalize() {
    return this.mutate(state => {
      if (!state.exercise.finalized) {
        const now = Date.now();
        state.exercise.finalized = true;
        state.exercise.finalizedAt = now;
        state.exercise.updatedAt = now;
      }
      return { ...state.exercise };
    });
  }

  async reopen() {
    return this.mutate(state => {
      const now = Date.now();
      state.exercise.finalized = false;
      state.exercise.finalizedAt = null;
      state.exercise.updatedAt = now;
      return { ...state.exercise };
    });
  }

  async reset() {
    return this.mutate(state => {
      const fresh = emptyState();
      state.exercise = fresh.exercise;
      state.submissions = [];
      return this.snapshot();
    });
  }

  async mutate(mutator) {
    let result;
    const operation = this.writeChain.then(async () => {
      result = mutator(this.state);
      await this.persist();
    });
    this.writeChain = operation.catch(() => undefined);
    await operation;
    return result;
  }

  async persist() {
    const temporary = `${this.filePath}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    await fs.rename(temporary, this.filePath);
  }
}

module.exports = { ExerciseStore, emptyState, normalizeState, VALID_STATUSES };
