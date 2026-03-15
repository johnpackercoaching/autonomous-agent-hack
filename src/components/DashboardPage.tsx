import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { rtdb } from '../firebase';
import './DashboardPage.css';

interface HackathonStatus {
  currentHour: number;
  currentTeam: string;
  status: 'idle' | 'running' | 'complete';
}

function formatElapsed(ms: number): string {
  if (ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

const HOUR_LABELS: Record<number, string> = {
  1: 'Problem Selection',
  2: 'Problem Deep Dive',
  3: 'Competitive Landscape',
  4: 'User Persona Definition',
  5: 'Architecture Brainstorm',
  6: 'Architecture Decision',
  7: 'Data Model Design',
  8: 'API Design',
  9: 'MVP Scope Definition',
  10: 'Discovery Review',
};

export function DashboardPage() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [loading, setLoading] = useState(true);
  const [hackathonStatus, setHackathonStatus] = useState<HackathonStatus | null>(null);

  useEffect(() => {
    const timerRef = ref(rtdb, 'hackathon/timer/startedAt');
    const unsubscribe = onValue(
      timerRef,
      (snapshot) => {
        const val = snapshot.val();
        setStartedAt(typeof val === 'number' ? val : null);
        setLoading(false);
      },
      (err) => {
        console.error('Timer RTDB listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const statusRef = ref(rtdb, 'hackathon/status');
    const unsubscribe = onValue(
      statusRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          setHackathonStatus(val as HackathonStatus);
        } else {
          setHackathonStatus(null);
        }
      },
      (err) => {
        console.error('Status RTDB listener error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed('00:00:00');
      return;
    }
    setElapsed(formatElapsed(Date.now() - startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const handleStart = useCallback(() => {
    const timerRef = ref(rtdb, 'hackathon/timer/startedAt');
    const statusRef = ref(rtdb, 'hackathon/status');
    set(timerRef, Date.now()).catch((err) => {
      console.error('Failed to start hackathon timer:', err);
    });
    set(statusRef, {
      currentHour: 1,
      currentTeam: 'team_01',
      status: 'running',
    }).catch((err) => {
      console.error('Failed to set hackathon status:', err);
    });
  }, []);

  const handleStop = useCallback(() => {
    const timerRef = ref(rtdb, 'hackathon/timer/startedAt');
    const statusRef = ref(rtdb, 'hackathon/status');
    set(timerRef, null).catch((err) => {
      console.error('Failed to reset hackathon timer:', err);
    });
    set(statusRef, null).catch((err) => {
      console.error('Failed to reset hackathon status:', err);
    });
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const hourLabel = hackathonStatus
    ? HOUR_LABELS[hackathonStatus.currentHour] || `Hour ${hackathonStatus.currentHour}`
    : '';

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <p className="dashboard-subtitle">Command Center</p>
        <h2>Autonomous Agent Hackathon</h2>
      </div>

      <div className="dashboard-timer-section">
        {startedAt === null ? (
          <div className="dashboard-start-container">
            <button
              className="dashboard-start-btn"
              onClick={handleStart}
              type="button"
              aria-label="Start the hackathon timer"
            >
              Start Hackathon
            </button>
            <p className="dashboard-start-hint">
              Launches Team 01 Hour 1 and starts the event timer
            </p>
          </div>
        ) : (
          <div className="dashboard-active-container">
            <div className="dashboard-status-badge">
              <span className="dashboard-status-dot" aria-hidden="true" />
              <span className="dashboard-status-label">Live</span>
            </div>
            <div className="dashboard-timer" role="timer" aria-label={`Elapsed time: ${elapsed}`}>
              {elapsed}
            </div>
            <p className="dashboard-timer-started">
              Started {new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              className="dashboard-reset-btn"
              onClick={handleStop}
              type="button"
              aria-label="Reset the hackathon timer"
            >
              Reset Timer
            </button>
          </div>
        )}
      </div>

      {hackathonStatus && hackathonStatus.status !== 'idle' && (
        <div className="dashboard-kickoff-section">
          <div className="dashboard-kickoff-header">
            <span className="dashboard-kickoff-label">Current Activity</span>
          </div>
          <div className="dashboard-kickoff-body">
            <div className="dashboard-kickoff-team">
              <span className="dashboard-kickoff-team-name">
                {hackathonStatus.currentTeam.replace('team_', 'Team ')}
              </span>
              <span className="dashboard-kickoff-separator">/</span>
              <span className="dashboard-kickoff-hour">
                Hour {hackathonStatus.currentHour}: {hourLabel}
              </span>
            </div>
            <div className="dashboard-kickoff-progress">
              {['Connecting', 'Running', 'Complete'].map((step, i) => {
                const isRunning = hackathonStatus.status === 'running';
                const isComplete = hackathonStatus.status === 'complete';
                const isDone = (i === 0 && (isRunning || isComplete)) ||
                               (i === 1 && isComplete) ||
                               (i === 2 && isComplete);
                const isActive = (i === 0 && !isRunning && !isComplete) ||
                                 (i === 1 && isRunning);
                return (
                  <div key={step} className="dashboard-progress-row">
                    {i > 0 && <div className={`dashboard-progress-line ${isDone ? 'done' : ''}`} />}
                    <div className={`dashboard-progress-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                      <span className="dashboard-progress-dot" />
                      <span className="dashboard-progress-label">{step}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {hackathonStatus.status === 'complete' && (
              <div className="dashboard-kickoff-complete">
                <p>Hour {hackathonStatus.currentHour} complete. Review output below.</p>
                <a href="/live" className="dashboard-kickoff-link">
                  View Output
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
