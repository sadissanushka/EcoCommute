/**
 * Anomaly Escalation Ladder State Machine
 * Module 4: Safety Layer (Amaraweera MTP - 244015X)
 * 
 * Manages per-trip real-time deviation escalation and hysteresis de-escalation:
 * NORMAL -> WARNING (3 consecutive mild) -> ADMIN_ALERT (6 consecutive / >400m) -> AUTO_SOS (3 consecutive severe)
 */

export type DetectorState = 'NORMAL' | 'WARNING' | 'ADMIN_ALERT' | 'AUTO_SOS';

export interface DetectorConfig {
  mildThresholdMeters: number;       // default 250m
  severeThresholdMeters: number;     // default 1000m
  warningConsecutiveCount: number;   // default 3
  adminAlertConsecutiveCount: number;// default 6
  autoSosConsecutiveCount: number;   // default 3
  hysteresisConsecutiveCount: number;// default 2 points within mild to reset
  maxAccuracyMeters: number;         // default 100m
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  mildThresholdMeters: 250,
  severeThresholdMeters: 1000,
  warningConsecutiveCount: 3,
  adminAlertConsecutiveCount: 6,
  autoSosConsecutiveCount: 3,
  hysteresisConsecutiveCount: 2,
  maxAccuracyMeters: 100.0,
};

export interface DetectorTransition {
  previousState: DetectorState;
  currentState: DetectorState;
  distanceMeters: number;
  consecutiveMild: number;
  consecutiveSevere: number;
  consecutiveNormal: number;
  escalated: boolean;
  deescalated: boolean;
  actionRequired: 'NONE' | 'BROADCAST_WARNING' | 'ADMIN_ALERT' | 'TRIGGER_AUTO_SOS';
  reason?: string;
}

export class TripDetectorStateMachine {
  public currentState: DetectorState = 'NORMAL';
  public consecutiveMildCount: number = 0;
  public consecutiveSevereCount: number = 0;
  public consecutiveNormalCount: number = 0;
  public config: DetectorConfig;
  public lastSegmentIndex: number = 0;

  constructor(customConfig?: Partial<DetectorConfig>) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...customConfig };
  }

  public processPoint(
    distanceMeters: number,
    accuracyMeters: number = 5.0
  ): DetectorTransition {
    const prevState = this.currentState;

    // Filter out degraded GPS accuracy fixes to avoid false triggers
    if (accuracyMeters > this.config.maxAccuracyMeters) {
      return {
        previousState: prevState,
        currentState: prevState,
        distanceMeters,
        consecutiveMild: this.consecutiveMildCount,
        consecutiveSevere: this.consecutiveSevereCount,
        consecutiveNormal: this.consecutiveNormalCount,
        escalated: false,
        deescalated: false,
        actionRequired: 'NONE',
        reason: `Ignored GPS point due to poor accuracy (${accuracyMeters}m > ${this.config.maxAccuracyMeters}m)`,
      };
    }

    // 1. Evaluate distance categories
    const isSevere = distanceMeters >= this.config.severeThresholdMeters;
    const isMild = distanceMeters >= this.config.mildThresholdMeters;

    if (isSevere) {
      this.consecutiveSevereCount++;
      this.consecutiveMildCount++;
      this.consecutiveNormalCount = 0;
    } else if (isMild) {
      this.consecutiveMildCount++;
      this.consecutiveSevereCount = 0;
      this.consecutiveNormalCount = 0;
    } else {
      // Point is on-route (within mild threshold)
      this.consecutiveNormalCount++;
      if (this.consecutiveNormalCount >= this.config.hysteresisConsecutiveCount) {
        this.consecutiveMildCount = 0;
        this.consecutiveSevereCount = 0;
      }
    }

    // 2. State transition logic
    let nextState: DetectorState = this.currentState;
    let action: DetectorTransition['actionRequired'] = 'NONE';

    // AUTO_SOS check (Highest priority)
    if (this.consecutiveSevereCount >= this.config.autoSosConsecutiveCount) {
      nextState = 'AUTO_SOS';
      if (prevState !== 'AUTO_SOS') {
        action = 'TRIGGER_AUTO_SOS';
      }
    }
    // ADMIN_ALERT check (6 consecutive mild OR 3 consecutive severe)
    else if (
      this.consecutiveMildCount >= this.config.adminAlertConsecutiveCount ||
      (this.consecutiveMildCount >= 4 && distanceMeters >= 400.0)
    ) {
      if (this.currentState !== 'AUTO_SOS') {
        nextState = 'ADMIN_ALERT';
        if (prevState !== 'ADMIN_ALERT') {
          action = 'ADMIN_ALERT';
        }
      }
    }
    // WARNING check (3 consecutive mild)
    else if (this.consecutiveMildCount >= this.config.warningConsecutiveCount) {
      if (this.currentState === 'NORMAL') {
        nextState = 'WARNING';
        action = 'BROADCAST_WARNING';
      }
    }
    // De-escalation with Hysteresis
    else if (this.consecutiveNormalCount >= this.config.hysteresisConsecutiveCount) {
      nextState = 'NORMAL';
    }

    const escalated = this.isStateHigher(nextState, prevState);
    const deescalated = this.isStateHigher(prevState, nextState);
    this.currentState = nextState;

    return {
      previousState: prevState,
      currentState: nextState,
      distanceMeters,
      consecutiveMild: this.consecutiveMildCount,
      consecutiveSevere: this.consecutiveSevereCount,
      consecutiveNormal: this.consecutiveNormalCount,
      escalated,
      deescalated,
      actionRequired: action,
    };
  }

  private isStateHigher(a: DetectorState, b: DetectorState): boolean {
    const rank: Record<DetectorState, number> = {
      NORMAL: 0,
      WARNING: 1,
      ADMIN_ALERT: 2,
      AUTO_SOS: 3,
    };
    return rank[a] > rank[b];
  }
}
