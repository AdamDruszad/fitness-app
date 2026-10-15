import Layout from '../components/Layout';
import PageHeading from '../components/PageHeading';
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import client from '../api/client';
import { IconFlame, IconBarbell, IconChevronRight, IconPlayerPlayFilled, IconArrowUpRight, IconHistory, IconSparkles, IconRefresh } from '@tabler/icons-react';
import { getNextTrainingDay } from '../utils/workout';
import { loadDraft } from '../utils/drafts';
import { useAuth } from '../hooks/useAuth';
import { countLabel } from '../utils/format';
import { Notice, LoadingLine } from '../components/ui';
import InstallHelp from '../components/InstallHelp';

const shortDate = date => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const dose = exercise => exercise.measurement === 'duration' ? `${exercise.sets} × ${exercise.duration_seconds} s` : `${exercise.sets} × ${exercise.reps}`;

export default function Dashboard() {
  const { user } = useAuth();
  const [draft, setDraft] = useState(null);
  const [summary, setSummary] = useState(null);
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionsError, setSessionsError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadDraft(user.id).then(record => { if (!controller.signal.aborted) setDraft(record.draft); }).catch(() => {});
    client.get('/sessions/summary', { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setSummary(r.data); }).catch(() => {});
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
  }, [reload, user.id]);

  const days = plan?.plan_data?.days || [];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const nextDay = getNextTrainingDay(days);
  const isToday = nextDay?.day === todayName;
  const completed = sessions.filter(s => s.status === 'completed');
  const recentCount = sessionsLoading || sessionsError ? '—' : completed.length;
  const weekCount = summary?.week_completed ?? '—';
  const retry = () => setReload(value => value + 1);

  return <Layout contentClassName="dashboard">
    <PageHeading eyebrow="Your training space" title="Your plan" description="One session at a time. Make today count.">
      <Link className="btn btn--secondary" to="/coach"><IconSparkles size={18} stroke={1.75} aria-hidden="true" />Improve my existing routine</Link>
      <Link className="btn btn--quiet" to="/plans/history"><IconHistory size={18} stroke={1.75} aria-hidden="true" />Plan history</Link>
    </PageHeading>
    {plan && <p className="plan-meta"><span className="plan-meta-title">{plan.plan_data.title}</span><span className="tag">Version {plan.version}</span></p>}

    {draft && <section className="card card--hero resume" aria-labelledby="resume-heading">
      <div className="stack-sm">
        <h2 id="resume-heading" className="resume-heading">
          <span className="eyebrow"><span className="status-dot status-dot--busy" aria-hidden="true" />Workout in progress ·</span>{' '}
          <span className="display resume-title">{draft.day.day}</span>
        </h2>
        <p className="muted">Plan version {draft.version} · {draft.pending ? 'Waiting to sync' : 'Saved on this device'}</p>
      </div>
      <Link className="btn btn--primary btn--lg" to="/log"><IconPlayerPlayFilled size={18} aria-hidden="true" />Resume workout</Link>
    </section>}

    {error ? <Notice tone="error"><p role="alert">{error}</p><button className="btn btn--secondary btn--sm" type="button" onClick={retry}><IconRefresh size={16} aria-hidden="true" />Try again</button></Notice>
      : loading ? <div className="dashboard-loading"><LoadingLine>Loading your plan…</LoadingLine><div className="skeleton dashboard-skeleton" aria-hidden="true" /></div>
      : !nextDay ? <div className="empty dashboard-empty">
          <IconBarbell size={36} stroke={1.5} aria-hidden="true" />
          <h2>Your next chapter starts here.</h2>
          <p>Create a plan around your goals, equipment and schedule.</p>
          <Link to="/onboarding" className="btn btn--primary btn--lg">Create your plan<IconArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      : <div className="dashboard-grid">
        <div className="stack-lg">
          <section className={`card next-up${draft ? '' : ' card--hero'}`} aria-labelledby="next-workout-heading">
            <div className="next-up-head">
              <p className="eyebrow next-up-label">{isToday ? `Today · ${todayName}` : `Next up · ${nextDay.day}`}</p>
              <IconFlame size={22} stroke={1.75} className="next-up-flame" aria-hidden="true" />
            </div>
            <h2 id="next-workout-heading" className="display next-up-title">{nextDay.focus || nextDay.day}</h2>
            <p className="next-up-meta">{countLabel(nextDay.exercises.length, 'exercise')}<span aria-hidden="true">·</span>Ready when you are</p>
            <ol className="next-up-list">
              {nextDay.exercises.map(exercise => <li key={exercise.id || exercise.name}><span>{exercise.name}</span><span className="num">{dose(exercise)}</span></li>)}
            </ol>
            <Link to="/log" state={{ day: nextDay.day }} className={`btn btn--lg ${draft ? 'btn--secondary' : 'btn--primary'}`}><IconPlayerPlayFilled size={18} aria-hidden="true" />{isToday ? "Start today's workout" : 'Open workout'}</Link>
          </section>

          <section aria-labelledby="weekly-plan-heading">
            <div className="section-head"><h2 id="weekly-plan-heading">Your training week</h2><span>{countLabel(days.length, 'day')} in your plan</span></div>
            <ul className="ledger">{days.map((day, index) => <li key={day.day}>
              <Link to="/log" state={{ day: day.day }} className={`ledger-row week-day${day.day === todayName ? ' is-today' : ''}`}>
                <span className="ledger-index num">{String(index + 1).padStart(2, '0')}</span>
                <div className="ledger-main">
                  <h3 className="ledger-title">{day.day}{day.day === todayName && <span className="tag tag--accent today-tag">Today</span>}</h3>
                  <p className="ledger-meta">{day.focus || 'Recovery'} · {countLabel(day.exercises?.length || 0, 'exercise')}</p>
                </div>
                <IconChevronRight size={20} stroke={1.75} className="ledger-end" aria-hidden="true" />
              </Link>
            </li>)}</ul>
          </section>
        </div>

        <aside className="stack-lg" aria-label="Training activity">
          <section className="card glance" aria-labelledby="overview-heading">
            <div className="section-head"><h2 id="overview-heading">At a glance</h2></div>
            <div className="glance-stats">
              <div className="stat"><strong className="stat-value num">{plan?.plan_data?.weeks || 8}<small>weeks</small></strong><span className="stat-label">Intended length</span></div>
              <div className="stat"><strong className="stat-value num">{weekCount}</strong><span className="stat-label">Completed this week</span></div>
            </div>
            <p className="glance-foot"><span className="num">{recentCount}</span> {recentCount === 1 ? 'recent session' : 'recent sessions'} loaded</p>
            <Link to="/progress" className="btn btn--ghost glance-link">Explore your progress<IconArrowUpRight size={16} aria-hidden="true" /></Link>
          </section>

          <section aria-labelledby="recent-sessions-heading">
            <div className="section-head"><h2 id="recent-sessions-heading">Recent sessions</h2></div>
            {sessionsError ? <Notice tone="error"><p role="alert">{sessionsError}</p><button type="button" className="btn btn--ghost btn--sm" onClick={retry}>Try again</button></Notice>
              : sessionsLoading ? <LoadingLine>Loading sessions…</LoadingLine>
              : sessions.length ? <ul className="ledger">{sessions.slice(0, 4).map((session, index) => <li key={session.id || index}>
                  <Link className="ledger-row recent-row" to={`/sessions/${session.id}`}>
                    <span className="date-chip" aria-hidden="true"><span className="num">{new Date(`${session.session_date}T00:00:00`).getDate()}</span>{new Date(`${session.session_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <div className="ledger-main"><p className="ledger-title">{shortDate(session.session_date)}</p><p className="ledger-meta">{countLabel((session.exercise_logs || []).length, 'exercise')} logged</p></div>
                    <IconChevronRight size={18} stroke={1.75} className="ledger-end" aria-hidden="true" />
                  </Link>
                </li>)}</ul>
              : <p className="empty small">Your completed sessions will appear here. Start with your first workout.</p>}
          </section>
        </aside>
      </div>}
    <InstallHelp />
  </Layout>;
}
