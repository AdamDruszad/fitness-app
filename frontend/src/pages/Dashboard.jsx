/**
 * @file Dashboard.jsx
 * @description Main application dashboard view.
 * Fetches user's current workout plan and recent workout sessions.
 * Highlights today's planned routine, quick actions to launch today's workout logger,
 * weekly training breakdown, aggregate stats (plan duration, sessions this week, total logged),
 * and recent workout sessions history.
 */

import Layout from "../components/Layout";
import { useState, useEffect } from "react";
import client from "../api/client";
import {
  IconArrowNarrowDownDashed,
  IconFlame,
  IconBarbell,
  IconChevronRight,
  IconCalendar,
  IconPlayerPlayFilled
} from '@tabler/icons-react';
import { useNavigate } from "react-router";

export default function Dashboard() {
  const [plan, setPlan] = useState();
  const [sessions, setSessions] = useState();
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionsError, setSessionsError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    // 1. Fetch current active workout plan
    setLoading(true);
    client.get('/plans/current')
      .then((r) => setPlan(r.data))
      .catch((err) => {
        // HTTP 404 indicates user has not generated a plan yet
        if (err.response?.status === 404) {
          setPlan(null);
        } else {
          setError("Something went wrong, please try again");
        }
      })
      .finally(() => setLoading(false));

    // 2. Fetch logged workout sessions history
    setSessionsLoading(true);
    client.get('/sessions')
      .then((r) => setSessions(r.data))
      .catch(() => {
        // Backend returns [] when empty, so an error here is network or server failure
        setSessionsError("Could not load sessions");
        setSessions([]);
      })
      .finally(() => setSessionsLoading(false));
  }, []);

  // Compute today's day name to find matching scheduled workout
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const exactMatchPlan = plan?.plan_data?.days?.find((d) => d.day === todayName);
  const todayPlan = exactMatchPlan ?? plan?.plan_data?.days?.[0];
  const totalWeeks = plan?.plan_data?.weeks || 8;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-text-main">Your plan</h1>

        {/* Global Error Banner */}
        {error ? (
          <p className="px-4 py-2 flex justify-center items-center text-red-400 text-sm -mt-1 border border-red-400 rounded-md shadow-xl/50 shadow-red-400/40">
            {error}
          </p>
        ) : loading ? (
          /* Loading State Spinner */
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 bg-brand-accent/10 rounded-full animate-pulse">
              <IconBarbell className="text-brand-accent" size={32} stroke={1.5} />
            </div>
            <p className="text-text-muted text-sm font-medium animate-pulse">Warming up...</p>
          </div>
        ) : plan === null ? (
          /* Empty State: No active plan generated */
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-xl font-semibold text-text-main">You don't have a plan</h2>
            <p className="text-text-muted">Please generate one here</p>
            <IconArrowNarrowDownDashed stroke={2} className="text-brand-accent" />
            <button
              className="border border-border-subtle bg-brand-accent rounded-lg py-2 px-4 font-medium text-text-main hover:bg-brand-accent/50 transition cursor-pointer"
              type="button"
              onClick={() => navigate("/onboarding")}
            >
              Generate a Plan
            </button>
          </div>
        ) : todayPlan ? (
          <>
            {/* Today's / Next Scheduled Workout Banner */}
            <div className="rounded-2xl p-5 bg-brand-accent/15 border border-brand-accent/35 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-brand-accent/70 text-sm">
                <span>{exactMatchPlan ? <>Today &middot; {todayName}</> : <>Next up &middot; {todayPlan.day}</>}</span>
                <IconFlame size={20} />
              </div>
              <h2 className="text-2xl font-bold text-text-main">{todayPlan.focus}</h2>
              <span className="text-brand-accent/70 text-sm">{todayPlan.exercises?.length || 0} exercises</span>
            </div>

            {/* Quick Action: Start Workout */}
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-3.5 px-4 active:scale-[0.98] transition text-[15px] font-bold text-white rounded-xl bg-brand-accent hover:bg-brand-accent/90 cursor-pointer"
              onClick={() => navigate('/log', { state: { day: todayPlan.day } })}
            >
              <IconPlayerPlayFilled size={20} />
              Start today's workout
            </button>

            {/* Week Schedule List */}
            <div>
              <div className="text-[13px] text-text-muted font-semibold mb-2.5">This week's plan</div>
              <div className="flex flex-col gap-2">
                {plan?.plan_data?.days?.map((dayPlan, idx) => {
                  const isToday = dayPlan.day === todayName;
                  return (
                    <div
                      key={idx}
                      onClick={() => navigate('/log', { state: { day: dayPlan.day } })}
                      className={`border rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] ${
                        isToday
                          ? 'bg-brand-accent/10 border-brand-accent'
                          : 'bg-surface/70 border-border-subtle hover:border-text-muted/30 hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <IconBarbell className={isToday ? 'text-brand-accent' : 'text-text-muted'} size={22} stroke={1.5} />
                        <div>
                          <div className="text-sm font-semibold text-text-main">{dayPlan.day}</div>
                          <div className="text-xs text-text-muted mt-0.5">{dayPlan.focus} &middot; {dayPlan.exercises?.length || 0} exercises</div>
                        </div>
                      </div>
                      <IconChevronRight className={isToday ? 'text-brand-accent' : 'text-text-muted'} size={20} stroke={1.5} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Metrics / Stats Row */}
            <div className="grid grid-cols-3 gap-2.5 mt-2">
              <div className="bg-surface/70 border border-border-subtle rounded-xl p-3.5">
                <div className="text-xs text-text-muted">Plan length</div>
                <div className="text-2xl font-bold mt-1 text-text-main">{totalWeeks}w</div>
              </div>
              <div className="bg-surface/70 border border-border-subtle rounded-xl p-3.5">
                <div className="text-xs text-text-muted">This week</div>
                <div className="text-2xl font-bold mt-1 text-text-main">
                  {sessionsLoading ? (
                    <span className="text-sm text-text-muted animate-pulse">—</span>
                  ) : sessionsError ? (
                    <span className="text-sm text-text-muted">—</span>
                  ) : (
                    sessions?.filter((s) => (new Date() - new Date(s.session_date)) / (1000 * 60 * 60 * 24) <= 7)?.length ?? 0
                  )}
                </div>
              </div>
              <div className="bg-surface/70 border border-border-subtle rounded-xl p-3.5">
                <div className="text-xs text-text-muted">Logged</div>
                <div className="text-2xl font-bold mt-1 text-text-main">
                  {sessionsLoading ? (
                    <span className="text-sm text-text-muted animate-pulse">—</span>
                  ) : sessionsError ? (
                    <span className="text-sm text-text-muted">—</span>
                  ) : (
                    sessions?.length ?? 0
                  )}
                </div>
              </div>
            </div>

            {/* Recent Sessions Activity List */}
            <div className="mt-2">
              <div className="text-[13px] text-text-muted font-semibold mb-2.5">Recent sessions</div>
              {sessionsError ? (
                <p className="text-xs text-red-400 text-center py-4">{sessionsError}</p>
              ) : sessionsLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-surface/70 border border-border-subtle rounded-xl px-3.5 py-3 h-11 animate-pulse" />
                  ))}
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {sessions.slice(0, 3).map((s, idx) => (
                    <div key={idx} className="bg-surface/70 border border-border-subtle rounded-xl px-3.5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-sm font-medium text-text-main">
                        <IconCalendar size={18} className="text-text-muted" />
                        {new Date(s.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <span className="text-[13px] text-text-muted">{(s.exercise_logs || []).length} exercises</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface/40 border border-border-subtle border-dashed rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2">
                  <IconCalendar size={24} className="text-text-muted/50" />
                  <p className="text-text-muted text-sm">No sessions logged yet.</p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}