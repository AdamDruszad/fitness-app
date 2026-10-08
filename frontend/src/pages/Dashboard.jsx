import Layout from '../components/Layout';
import PageHeading from '../components/PageHeading';
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import client from '../api/client';
import { IconFlame, IconBarbell, IconChevronRight, IconCalendar, IconPlayerPlayFilled, IconArrowUpRight } from '@tabler/icons-react';
import { getNextTrainingDay, isWithinLastSevenDays } from '../utils/workout';

export default function Dashboard() {
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionsError, setSessionsError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSessionsLoading(true);
    setError('');
    setSessionsError('');
    client.get('/plans/current', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setPlan(data); })
      .catch(err => {
        if (controller.signal.aborted) return;
        if (err.response?.status === 404) setPlan(null);
        else setError('Could not load your plan. Please try again.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    client.get('/sessions', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSessions(data); })
      .catch(() => { if (!controller.signal.aborted) setSessionsError('Could not load recent sessions.'); })
      .finally(() => { if (!controller.signal.aborted) setSessionsLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const days = plan?.plan_data?.days || [];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const nextDay = getNextTrainingDay(days);
  const isToday = nextDay?.day === todayName;
  const recentCount = sessionsLoading || sessionsError ? '—' : sessions.length;
  const weekCount = sessionsLoading || sessionsError ? '—' : sessions.filter(session => isWithinLastSevenDays(session.session_date)).length;

  return <Layout contentClassName="dashboard-content">
    <PageHeading eyebrow="Your training space" title="Your plan" description="One session at a time. Make today count." />
    {error ? <div className="workout-empty"><p role="alert">{error}</p><button className="fitai-secondary-button" type="button" onClick={() => setReload(value => value + 1)}>Try again</button></div>
      : loading ? <div className="workout-empty" role="status"><IconBarbell size={32} aria-hidden="true" /><p>Loading your plan…</p></div>
      : !nextDay ? <div className="dashboard-empty"><IconBarbell size={38} aria-hidden="true" /><h2>Your next chapter starts here.</h2><p>Create a plan around your goals, equipment and schedule.</p><Link to="/onboarding" className="fitai-primary-button">Create your plan<IconArrowUpRight size={17} aria-hidden="true" /></Link></div>
      : <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="next-workout" aria-labelledby="next-workout-heading">
            <div className="next-workout-label"><span>{isToday ? `Today · ${todayName}` : `Next up · ${nextDay.day}`}</span><IconFlame size={21} aria-hidden="true" /></div>
            <h2 id="next-workout-heading">{nextDay.focus || nextDay.day}</h2>
            <p>{nextDay.exercises.length} exercises<span>•</span>Ready when you are</p>
            <Link to="/log" state={{ day: nextDay.day }} className="fitai-primary-button"><IconPlayerPlayFilled size={17} aria-hidden="true" />{isToday ? "Start today's workout" : 'Open workout'}</Link>
          </section>
          <section aria-labelledby="weekly-plan-heading">
            <div className="section-heading"><h2 id="weekly-plan-heading">Your training week</h2><span>{days.length} days in your plan</span></div>
            <div className="schedule-list">{days.map((day, index) => <Link to="/log" state={{ day: day.day }} key={day.day} className={`schedule-day${day.day === todayName ? ' is-today' : ''}`}>
              <span className="schedule-number">{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{day.day}{day.day === todayName && <span className="today-tag">Today</span>}</h3><p>{day.focus || 'Recovery'}<span>·</span>{day.exercises?.length || 0} exercises</p></div>
              <IconChevronRight size={18} aria-hidden="true" />
            </Link>)}</div>
          </section>
        </div>
        <aside className="dashboard-secondary" aria-label="Training activity">
          <section className="training-overview" aria-labelledby="overview-heading">
            <div className="section-heading"><h2 id="overview-heading">At a glance</h2><IconChartMark aria-hidden="true" /></div>
            <div className="overview-stats"><div><strong>{plan?.plan_data?.weeks || 8}<small>weeks</small></strong><span>Plan length</span></div><div><strong>{weekCount}</strong><span>Last 7 days</span></div></div>
            <p>{recentCount} recent sessions loaded</p>
            <Link to="/progress" className="text-link">Explore your progress<IconArrowUpRight size={16} aria-hidden="true" /></Link>
          </section>
          <section aria-labelledby="recent-sessions-heading">
            <div className="section-heading"><h2 id="recent-sessions-heading">Recent sessions</h2><IconCalendar size={16} aria-hidden="true" /></div>
            {sessionsError ? <div className="activity-empty"><p role="alert">{sessionsError}</p><button type="button" className="text-link" onClick={() => setReload(value => value + 1)}>Try again</button></div>
              : sessionsLoading ? <p className="activity-empty" role="status">Loading sessions…</p>
              : sessions.length ? <div className="activity-list">{sessions.slice(0, 4).map((session, index) => <div className="activity-row" key={session.id || index}><IconCalendar size={18} aria-hidden="true" /><div><strong>{new Date(`${session.session_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{(session.exercise_logs || []).length} exercises logged</span></div></div>)}</div>
              : <p className="activity-empty">Your completed sessions will appear here. Start with your first workout.</p>}
          </section>
        </aside>
      </div>}
  </Layout>;
}

function IconChartMark() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 14V9m6 5V4m6 10V7" /></svg>;
}
