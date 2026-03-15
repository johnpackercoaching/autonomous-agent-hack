import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { rtdb } from '../firebase';
import './RubricPage.css';

const DEFAULT_RUBRIC = `# Judging Rubric

## Weighted Scoring — 6 Dimensions

This rubric evaluates hackathon prototypes against documented strategic pressure points. Every score is weighted to reflect what matters most.

---

## Cycle Gates (Pass/Fail — Must Pass to Proceed)

| Gate | Requirement | Fail Condition |
|---|---|---|
| G1: Clear Objective | Stated objective connected to a strategic pressure point | No objective or objective disconnected from strategic gaps |
| G2: Working Artifact | At least one auditable artifact produced with version history | No artifact or artifact without version control |
| G3: Evidence Classification | All claims classified as direct evidence, inference, or speculation | Unclassified claims presented as fact |
| G4: Decision Log | Key decisions documented with rationale | Decisions made but not logged |

---

## Scoring Anchors (0-10 Scale)

| Score | Meaning |
|---|---|
| **9-10** | Funded initiative — goes on the roadmap and gets a team |
| **7-8** | Strong prototype — worth continued investment, clear path to production |
| **5-6** | Promising concept — the insight is right but execution needs more cycles |
| **3-4** | Needs work — interesting direction but significant gaps |
| **1-2** | Off-target — does not address strategic needs or fails to demonstrate value |

---

### Dimension 1: Strategic Lock-In (Weight: 25%)

*Does this create switching costs that make the platform harder to leave?*

- **0**: No connection to strategic position
- **1-2**: Tangential feature that could exist on any platform
- **3-4**: Creates moderate value but does not increase switching costs
- **5-6**: Creates data or workflow dependencies that make the platform more valuable over time
- **7-8**: Establishes network effects or compounding data assets
- **9-10**: Creates a new category of lock-in — enterprises would restructure workflows around this

**Key question**: If a competitor shipped an identical feature tomorrow, would our version still win because of platform-specific advantages?

---

### Dimension 2: Revenue Mechanism (Weight: 20%)

*Is there a clear path from this prototype to revenue?*

- **0**: No revenue consideration
- **1-2**: Vague claim about "enterprise value" without mechanism
- **3-4**: Identifies a pricing model but no evidence of willingness to pay
- **5-6**: Clear revenue mechanism with market evidence
- **7-8**: Revenue mechanism validated against enterprise buyer behavior
- **9-10**: Creates a new pricing tier or expansion vector with quantified TAM

**Key question**: Could the sales team pitch this to a VP of Engineering next week? What would the price be?

---

### Dimension 3: User Impact (Weight: 20%)

*Does this solve a real problem that real users have documented?*

- **0**: No evidence of user need
- **1-2**: Assumed user need without evidence
- **3-4**: Cites user feedback but solution is speculative
- **5-6**: Directly addresses documented user pain with before/after demonstration
- **7-8**: Validated against multiple user feedback sources with measured improvement
- **9-10**: Transforms the user experience in a way that generates organic advocacy

**Key question**: Can you point to 3 specific user complaints this solves, with sources?

---

### Dimension 4: "Last Mile" Proof (Weight: 15%)

*Does this prove that AI meets enterprise workflows at the last mile?*

- **0**: No connection to the "last mile" thesis
- **1-2**: References the thesis but does not demonstrate it
- **3-4**: Shows AI interacting with content but in a scripted/limited way
- **5-6**: Demonstrates an agentic workflow that produces outcomes neither humans nor AI achieve alone
- **7-8**: Proves the "context layer" thesis — AI agents acting on structured workflow data produce measurably better outcomes
- **9-10**: Creates a reference implementation for selling the "last mile" story to enterprise buyers

**Key question**: If the CPO showed this demo to an enterprise CTO, would they understand why the context layer matters?

---

### Dimension 5: Enterprise Readiness (Weight: 10%)

*Could this ship to a Fortune 500 customer?*

- **0**: No enterprise consideration
- **1-2**: Consumer-grade prototype with no governance
- **3-4**: Acknowledges enterprise requirements but does not address them
- **5-6**: Includes basic governance (audit trail, permissions, compliance hooks)
- **7-8**: Production-path analysis with security, scalability, and compliance addressed
- **9-10**: Enterprise-ready: SOC 2 aware, role-based access, audit export, admin controls, SSO compatible

**Key question**: What would a CISO say about deploying this?

---

### Dimension 6: Craft & Finish (Weight: 10%)

*Does this feel like a product or a hackathon prototype?*

- **0**: Non-functional
- **1-2**: Barely functional, clearly rough
- **3-4**: Works but feels unfinished
- **5-6**: Clean, consistent, handles common edge cases
- **7-8**: Polished interaction design with thoughtful details
- **9-10**: Production-quality craft. The CPO would put their name on this

**Key question**: Would the CPO show this to an investor without caveats?

---

## Composite Score

Final Score = (Strategic Lock-In x 0.25) + (Revenue Mechanism x 0.20) + (User Impact x 0.20) + (Last Mile Proof x 0.15) + (Enterprise Readiness x 0.10) + (Craft & Finish x 0.10)

Maximum: 10.0 | Minimum meaningful: 5.0 | Target for "funded initiative": 8.0+

---

## Anti-Busywork Disqualifiers

1. **No strategic connection**: Prototype could exist on any platform
2. **Status theater**: Lengthy narrative with no working demo
3. **Score inflation**: High self-assessment unsupported by evidence
4. **Activity without output**: Many changes but no measurable state-change
5. **Generic AI wrapper**: AI features bolted on without leveraging unique data`;

const DIMENSIONS = [
  { name: 'Strategic Lock-In', weight: '25%', color: '#1c469c' },
  { name: 'Revenue Mechanism', weight: '20%', color: '#10b981' },
  { name: 'User Impact', weight: '20%', color: '#a78bfa' },
  { name: 'Last Mile Proof', weight: '15%', color: '#f0a000' },
  { name: 'Enterprise Readiness', weight: '10%', color: '#06b6d4' },
  { name: 'Craft & Finish', weight: '10%', color: '#ff3369' },
];

export function RubricPage() {
  const [rubricContent, setRubricContent] = useState<string>(DEFAULT_RUBRIC);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rubricRef = ref(rtdb, 'hackathon/rubric');
    const unsubscribe = onValue(
      rubricRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setRubricContent(data.content || DEFAULT_RUBRIC);
        } else {
          set(rubricRef, {
            content: DEFAULT_RUBRIC,
            lastUpdated: Date.now(),
            updatedBy: 'system-seed',
          }).catch((err) => console.error('Failed to seed rubric:', err));
          setRubricContent(DEFAULT_RUBRIC);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Rubric RTDB listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleEdit = useCallback(() => {
    setEditContent(rubricContent);
    setIsEditing(true);
    setSaveMessage(null);
  }, [rubricContent]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
    setSaveMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await set(ref(rtdb, 'hackathon/rubric'), {
        content: editContent,
        lastUpdated: Date.now(),
        updatedBy: 'web-app',
      });
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Rubric saved' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }, [editContent]);

  const inlineFormat = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  };

  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let tableHeaders: string[] = [];

    const flushTable = () => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="rubric-table-wrap">
            <table className="rubric-table">
              {tableHeaders.length > 0 && (
                <thead>
                  <tr>{tableHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}><span dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      inTable = false;
      tableRows = [];
      tableHeaders = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHeaders = line.split('|').filter(Boolean).map(c => c.trim());
          continue;
        }
        if (line.match(/^\|[\s-|]+\|$/)) continue;
        tableRows.push(line.split('|').filter(Boolean).map(c => c.trim()));
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (line.trim() === '') continue;
      if (line.match(/^---+$/)) { elements.push(<hr key={`hr-${elements.length}`} className="rubric-hr" />); continue; }
      if (line.startsWith('# ')) { elements.push(<h1 key={`h-${elements.length}`} className="rubric-h1">{line.slice(2)}</h1>); continue; }
      if (line.startsWith('## ')) { elements.push(<h2 key={`h-${elements.length}`} className="rubric-h2">{line.slice(3)}</h2>); continue; }
      if (line.startsWith('### ')) { elements.push(<h3 key={`h-${elements.length}`} className="rubric-h3">{line.slice(4)}</h3>); continue; }
      if (line.match(/^- /)) {
        elements.push(<div key={`li-${elements.length}`} className="rubric-li"><span dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} /></div>);
        continue;
      }
      if (line.match(/^\d+\. /)) {
        elements.push(<div key={`li-${elements.length}`} className="rubric-li rubric-li--num"><span dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} /></div>);
        continue;
      }
      elements.push(<p key={`p-${elements.length}`} className="rubric-p"><span dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} /></p>);
    }
    if (inTable) flushTable();
    return elements;
  };

  if (loading) {
    return (
      <div className="rubric-page">
        <div className="rubric-loading">
          <div className="rubric-spinner" />
          <p>Loading rubric...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rubric-page">
      <div className="rubric-header">
        <div>
          <h2 className="rubric-title">Judging Rubric</h2>
          <p className="rubric-subtitle">Source of truth for hackathon evaluation</p>
        </div>
        <div className="rubric-actions">
          {saveMessage && (
            <span className={`rubric-msg rubric-msg--${saveMessage.type}`}>{saveMessage.text}</span>
          )}
          {isEditing ? (
            <>
              <button className="rubric-btn rubric-btn--cancel" onClick={handleCancel}>Cancel</button>
              <button className="rubric-btn rubric-btn--save" onClick={handleSave} disabled={saving || editContent === rubricContent}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button className="rubric-btn rubric-btn--edit" onClick={handleEdit}>Edit Rubric</button>
          )}
        </div>
      </div>

      <div className="rubric-dims">
        {DIMENSIONS.map((d) => (
          <div key={d.name} className="rubric-dim" style={{ '--dc': d.color } as React.CSSProperties}>
            <span className="rubric-dim-w">{d.weight}</span>
            <span className="rubric-dim-n">{d.name}</span>
          </div>
        ))}
      </div>

      <div className="rubric-body">
        {isEditing ? (
          <textarea
            className="rubric-editor"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="rubric-display">{renderMarkdown(rubricContent)}</div>
        )}
      </div>
    </div>
  );
}

export default RubricPage;
