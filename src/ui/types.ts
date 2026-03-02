import type { Settings } from "../config";
import type { Job } from "../jobs";
import type { Skill } from "../skills";

export interface WebSnapshot {
  pid: number;
  startedAt: number;
  settings: Settings;
  jobs: Job[];
  skills: Skill[];
}

export interface WebServerHandle {
  stop: () => void;
  host: string;
  port: number;
}

export interface StartWebUiOptions {
  host: string;
  port: number;
  token?: string;
  getSnapshot: () => WebSnapshot;
  onJobsChanged?: () => void | Promise<void>;
  onSkillsChanged?: () => void | Promise<void>;
  onSettingsChanged?: () => void | Promise<void>;
}
