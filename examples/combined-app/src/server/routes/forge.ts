import type { Express } from "express";
import type { ForgeCandidateId } from "../../shared/forge-types.ts";
import type { ForgeMissionId } from "../../shared/missions/mission-types.ts";
import type { ForgeService } from "../forge-service.ts";
import { asyncHandler } from "./helpers.ts";

export function registerForgeRoutes(app: Express, forge: ForgeService): void {
  app.post(
    "/api/forge/start",
    asyncHandler(async (req, res) => {
      res.json(
        await forge.start(
          String(req.body.missionId ?? "incident-dispatch-v1") as ForgeMissionId,
        ),
      );
    }),
  );

  app.post(
    "/api/forge/judge",
    asyncHandler(async (req, res) => {
      res.json(await forge.judge(String(req.body.runId ?? "")));
    }),
  );

  app.post(
    "/api/forge/repair",
    asyncHandler(async (req, res) => {
      res.json(await forge.repair(String(req.body.runId ?? "")));
    }),
  );

  app.post(
    "/api/forge/verify",
    asyncHandler(async (req, res) => {
      res.json(await forge.verify(String(req.body.runId ?? "")));
    }),
  );

  app.post(
    "/api/forge/artifacts",
    asyncHandler(async (req, res) => {
      res.json(
        await forge.artifacts(
          String(req.body.runId ?? ""),
          String(req.body.candidateId ?? "") as ForgeCandidateId,
        ),
      );
    }),
  );

  app.post(
    "/api/forge/shutdown",
    asyncHandler(async (req, res) => {
      await forge.shutdown(String(req.body.runId ?? ""));
      res.json({ ok: true });
    }),
  );
}
