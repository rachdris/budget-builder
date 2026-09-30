/* ============================================================================
   Pinecone Budget Builder — prototype
   ----------------------------------------------------------------------------
   Five screens, seven ideas. Steps 3 and 4 of the curriculum share a screen
   (debt is an observation about expenses already entered, not new data), and
   steps 5 and 6 share one too — both are "where does what's left go?".

   Money is entered exactly once. Every other figure is derived.
   Nothing is stored or sent anywhere; state lives in memory for the session.
   ========================================================================= */

/* Seven curriculum steps, five screens. Two screens carry two steps each, so
   the step numbers live on SECTION headings inside them and the header track
   has seven segments — the numbers stay visible without re-gating the flow. */
const STEP_NAMES = [
  'Set your financial goals',
  'Estimate your after-tax income',
  'Fixed and variable expenses',
  'Debt payments',
  'Make room for precautionary saving',
  'Make room for further saving',
  'Review and revise',
];
const SCREENS = [
  { steps:[1], title:'Set your financial goals', lede:'What do you want your budget to achieve? Clear goals make your plan more effective.' },
  { steps:[2], title:'Estimate your after-tax income', lede:'Take-home, not salary. Enter what actually reaches your account after taxes and deductions. Include income from all sources: salary, side work, investment income.' },
  { steps:[3,4], title:'Expenses and debt payments', lede:'Reviewing past spending helps estimate these amounts.' },
  { steps:[5,6], title:'Make room for saving', lede:'Precautionary first, then longer-term goals.' },
  { steps:[7], title:'Review and revise', lede:'Everything you entered, in one place. A budget is a tool to adjust, not a test to pass.' },
];
const stepHead = (n, extra='') => `
  <div class="stepsec">
    <span class="snum">${n}</span>
    <span class="sname">${esc(STEP_NAMES[n-1])}</span>
  </div>${extra}`;

/* ------------------------------------------------------------------ step 1 */
const EXAMPLES = ['Pay off my credit card','Save for a car down payment',
  'Build up six months of expenses','Feel in control of my money',
  'Stop borrowing from family','Increase my net worth','Save for a move'];
const MAX_GOALS = 3;
const blankGoal = () => ({ text: '' });

/* ------------------------------------------------------------------ step 2 */
const FREQS = [
  /* `noun` names one pay period, so "it varies" can ask for a slow and a good
     ONE OF THOSE rather than always saying "month" under a weekly cadence. */
  { id:'weekly', label:'Every week', per:52/12, noun:'week' },
  { id:'biweekly', label:'Every 2 weeks', per:26/12, noun:'two weeks' },
  { id:'semimonthly', label:'Twice a month', per:2, noun:'half-month' },
  { id:'monthly', label:'Every month', per:1, noun:'month' },
  { id:'yearly', label:'Once a year', per:1/12, noun:'year' },
];
const freqBy = (id) => FREQS.find((f) => f.id === id) || FREQS[3];
const blankIncome = () => ({ label:'', amount:'', freq:'biweekly', varies:false, low:'', high:'' });

/* ------------------------------------------------------------------ step 3
   Insurance sits with the thing it insures, so a subtotal answers "what does
   my car cost me?". Rent is not debt; a mortgage is — only 'D' lines reach
   the debt panel. */
const EXP_FREQS = [
  { id:'monthly', label:'Monthly', per:1 },
  { id:'quarterly', label:'Quarterly', per:1/3 },
  { id:'halfyear', label:'Every 6mo', per:1/6 },
  { id:'yearly', label:'Yearly', per:1/12 },
];
const expFreqBy = (id) => EXP_FREQS.find((f) => f.id === id) || EXP_FREQS[0];

const CATALOG = [
  { id:'housing', name:'Housing and utilities', type:'F', items:[
    ['Rent','F'],['Mortgage','F','D'],['Renters or home insurance','F'],['Electricity','V'],
    ['Gas (heating)','V'],['Water and sewer','V'],['Phone','F'],['Internet','F'],
    ['Cable or TV','F'],['Home maintenance','V'],['Household supplies','V']] },
  { id:'transport', name:'Transportation', type:'F', items:[
    ['Car payment','F','D'],['Car insurance','F'],['Fuel','V'],
    ['Car maintenance and repairs','V'],['Transit pass or fares','V'],
    ['Parking or tolls','V'],['Rideshare or taxis','V']] },
  { id:'food', name:'Food', type:'V', items:[
    ['Groceries','V'],['Dining out','V'],['Coffee and takeaway','V']] },
  { id:'loans', name:'Loans and credit', type:'F', items:[
    ['Student loan payment','F','D'],['Credit card payment','F','D'],
    ['Personal loan','F','D'],['Other loan','F','D']] },
  { id:'health', name:'Health and wellness', type:'V', items:[
    ['Health insurance','F'],['Dental insurance','F'],['Medical and copays','V'],
    ['Prescriptions','V'],['Hair and personal care','V']] },
  { id:'clothing', name:'Clothing', type:'V', items:[
    ['Clothing','V'],['Shoes and accessories','V']] },
  { id:'fun', name:'Entertainment and travel', type:'V', items:[
    ['Movies, concerts, events','V'],['Hobbies','V'],['Travel and trips','V'],['Gifts','V']] },
  { id:'subs', name:'Subscriptions and memberships', type:'F', items:[
    ['Streaming services','F'],['Gym','F'],['Apps and software','F']] },
  { id:'other', name:'Other commitments', type:'F', items:[
    ['Childcare','F'],['Tuition or school fees','F'],['Union or professional dues','F'],
    ['Life and disability insurance','F']] },
];
/* Six on the page, three a tap away. Nine collapsed rows is a wall; these are
   the ones nearly everyone spends in, and the rest are in the add picker. */
const COMMON = ['housing','transport','food','loans','health','fun','subs'];
const buildGroup = (g, open=false) => ({
  id:g.id, name:g.name, type:g.type, mode:'items', open, quick:'',
  items:g.items.map(([label,t,d]) => ({ label, amount:'', freq:'monthly', t, d:d==='D' })),
});
/* All shut. Tried opening the first by default and it put ~30 fields between
   the heading and the second category — the wall the accordion exists to stop. */
const makeGroups = () => CATALOG.filter((g) => COMMON.includes(g.id)).map((g) => buildGroup(g));
let customSeq = 0;
const blankCategory = () => ({ id:'custom-'+(++customSeq), name:'', type:'V', custom:true,
  mode:'items', open:true, quick:'', items:[{label:'',amount:'',freq:'monthly',t:'V',d:false}] });

/* ------------------------------------------------------------------ step 4 */
const blankLongTerm = (label='') => ({ label, amount:'' });

/* ------------------------------------------------------------------- state */
const state = {
  i: 0,                                   // screen index
  goals: [blankGoal()],
  showExamples: false,
  income: [blankIncome()],
  exp: makeGroups(),
  extraDebt: '',
  addingCat: false,                       // the add-a-category picker on screen 3
  emergency: '', emergencyDone: false,
  goalAlloc: {},                          // goal index -> monthly amount
  longTerm: [blankLongTerm('Retirement'), blankLongTerm()],
  reviewWhen: '',
  chartMode: 'cat',
  showAll: false,
  drawer: false,
  seen: { 0: true },                       // screens actually visited
};

/* --------------------------------------------------------------- utilities */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isFinite(n)?n:0; };
const usd = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

const filledGoals = () => state.goals.filter((g) => g.text.trim());

/* ------------------------------------------------------------------- maths */
const rowMonthly = (r, high) => (r.varies ? num(high && r.high ? r.high : r.low) : num(r.amount)) * freqBy(r.freq).per;
function incomeTotals() {
  const rows = state.income.filter((r) => r.varies ? num(r.low) : num(r.amount));
  const plan = rows.reduce((t,r) => t + rowMonthly(r,false), 0);
  const high = rows.reduce((t,r) => t + rowMonthly(r,true), 0);
  return { plan, upside: Math.max(0, high-plan), anyVaries: rows.some((r)=>r.varies),
           anyFreq: rows.some((r)=>r.freq==='biweekly'||r.freq==='weekly') };
}
const lineMonthly = (r) => num(r.amount) * expFreqBy(r.freq).per;
const groupTotal = (g) => g.mode === 'quick' ? num(g.quick)
  : g.items.reduce((t,r) => t + lineMonthly(r), 0);
const expTotal = () => state.exp.reduce((t,g) => t + groupTotal(g), 0);

function expSplit() {
  let fixed = 0, varies = 0;
  for (const g of state.exp) {
    if (g.mode === 'quick') { g.type==='F' ? fixed += num(g.quick) : varies += num(g.quick); continue; }
    for (const r of g.items) r.t==='F' ? fixed += lineMonthly(r) : varies += lineMonthly(r);
  }
  return { fixed, varies };
}
const SECURED = ['Mortgage','Car payment'];
function debtLines() {
  const out = [];
  for (const g of state.exp) {
    if (g.mode === 'quick') {
      if (g.id === 'loans' && num(g.quick)) out.push({ label:g.name, amount:num(g.quick), secured:false });
      continue;
    }
    for (const r of g.items) if (r.d && num(r.amount))
      out.push({ label:r.label, amount:lineMonthly(r), secured:SECURED.includes(r.label) });
  }
  return out;
}
const hiddenDebtRisk = () => state.exp.some((g) =>
  g.mode==='quick' && num(g.quick) && ['housing','transport'].includes(g.id));

const longTermTotal = () => state.longTerm.reduce((t,r) => t + num(r.amount), 0);
const goalAllocTotal = () => filledGoals().reduce((t,_,i) => t + num(state.goalAlloc[i]), 0);
const savingTotal = () => num(state.emergency) + goalAllocTotal() + longTermTotal();
const unassigned = () => incomeTotals().plan - expTotal() - num(state.extraDebt) - savingTotal();

/* =========================================================== screen 1: goals */
function goalRow(g, i) {
  return `
    <div class="goalrow">
      <input class="inp" data-gi="${i}" data-gk="text" type="text"
             placeholder="What are you working toward?" value="${esc(g.text)}" />
      ${state.goals.length>1 ? `<button class="rm" data-rm="${i}" aria-label="Remove goal">&times;</button>`:''}
    </div>`;
}
function s1() {
  return `
    <p class="helper" style="margin:0 0 12px">Name them in your own words. You'll decide
      what to put toward each one at step 6.</p>
    ${state.goals.map(goalRow).join('')}
    <div class="rowbtns">
      ${state.goals.length<MAX_GOALS ? '<button class="btn ghost sm" data-add="1">Add another goal</button>':'<span></span>'}
      <button class="skip" data-extog="1">${state.showExamples?'Hide ideas':'Need ideas?'}</button>
    </div>
    ${state.showExamples ? `<div class="examples">
      <p class="label">Tap one to start from it</p>
      <div class="chips">${EXAMPLES.map((t,k) => {
        const full = state.goals.length>=MAX_GOALS && state.goals.every((g)=>g.text.trim());
        return `<button class="chip ${full?'muted':''}" ${full?'disabled':''} data-ex="${k}">${esc(t)}</button>`;
      }).join('')}</div></div>`:''}`;
}
const s1ok = () => filledGoals().length > 0;

/* ========================================================== screen 2: income */
function incomeRow(r, i) {
  const per = freqBy(r.freq).noun;
  const amount = r.varies ? `
    <div class="row2 range2">
      <div><label class="minilab" for="lo${i}">A slow ${per}</label>
        <div class="money"><span class="sym">$</span>
          <input class="inp" id="lo${i}" data-ii="${i}" data-ik="low" type="text"
                 inputmode="decimal" placeholder="0" value="${esc(r.low)}" /></div></div>
      <div><label class="minilab" for="hi${i}">A good ${per}</label>
        <div class="money"><span class="sym">$</span>
          <input class="inp" id="hi${i}" data-ii="${i}" data-ik="high" type="text"
                 inputmode="decimal" placeholder="0" value="${esc(r.high)}" /></div></div>
    </div>`
    : `<div class="money"><span class="sym">$</span>
        <input class="inp" data-ii="${i}" data-ik="amount" type="text" inputmode="decimal"
               placeholder="What lands in your account" value="${esc(r.amount)}" /></div>`;
  const m = rowMonthly(r,false);
  return `
    <div class="goalrow">
      <div class="goalrow-top">
        <input class="inp" data-ii="${i}" data-ik="label" type="text"
               placeholder="${i===0?'Main job':'Side work, benefits, investments'}" value="${esc(r.label)}" />
        ${state.income.length>1 ? `<button class="rm" data-irm="${i}" aria-label="Remove income source">&times;</button>`:''}
      </div>
      <div style="margin-top:9px">${amount}</div>
      <select class="inp sel" data-ii="${i}" data-ik="freq" style="margin-top:9px">
        ${FREQS.map((f)=>`<option value="${f.id}" ${r.freq===f.id?'selected':''}>${f.label}</option>`).join('')}
      </select>
      <label class="varies"><input type="checkbox" data-ivar="${i}" ${r.varies?'checked':''} /> It varies</label>
      ${m ? `<span class="permonth">${usd(m)} a month</span>`:''}
    </div>`;
}
function s2() {
  const t = incomeTotals();
  const notes = [];
  if (t.anyFreq) notes.push("Paid weekly or every two weeks? Some months have an extra payday. We've spread that across the year rather than letting it inflate one month.");
  if (t.anyVaries) notes.push(t.upside
    ? `Planning on ${usd(t.plan)}. In a good month you'd have ${usd(t.upside)} more to assign.`
    : 'We plan on your slow month, so the budget holds in a bad one.');
  return `
    ${state.income.map(incomeRow).join('')}
    <div class="rowbtns">
      <button class="btn ghost sm" data-iadd="1">Add another source</button>
      ${t.plan?`<span class="runtot">Monthly <b>${usd(t.plan)}</b></span>`:'<span></span>'}
    </div>
    ${notes.map((n)=>`<p class="tipline">${n}</p>`).join('')}`;
}
const s2ok = () => incomeTotals().plan > 0;

/* ================================================ screen 3: expenses + debt */
function groupCard(g, gi) {
  const tot = groupTotal(g);
  const filled = g.mode==='items' ? g.items.filter((r)=>num(r.amount)).length : 0;
  const head = `
    <button class="gchead" data-gopen="${gi}" aria-expanded="${g.open?'true':'false'}">
      <span class="gcname ${g.custom&&!g.name?'untitled':''}">${esc(g.name||'New category')}</span>
      <span class="gcmeta">${filled?`${filled} item${filled>1?'s':''}`:''}</span>
      <span class="gctot ${tot?'has':''}">${tot?usd(tot):''}</span>
      <svg class="caret ${g.open?'open':''}" viewBox="0 0 16 16" width="16" height="16"
           aria-hidden="true" focusable="false"><path d="M3.5 6L8 10.5 12.5 6" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  if (!g.open) return `<div class="gcard">${head}</div>`;

  const nameField = !g.custom ? '' : `
    <div class="cname">
      <input class="inp" data-cname="${gi}" type="text" placeholder="Name this category" value="${esc(g.name)}" />
      <button class="skip" data-grm="${gi}">Remove category</button>
    </div>`;
  const body = g.mode==='quick' ? `
      <div class="gquick">
        <div class="money"><span class="sym">$</span>
          <input class="inp" data-q="${gi}" type="text" inputmode="decimal"
                 placeholder="Total each month" value="${esc(g.quick)}" /></div>
        <button class="skip" data-gmode="${gi}">Break it down instead</button>
      </div>`
    : `<div class="gitems">
        ${g.items.map((r,ri)=>`
          <div class="irow">
            <input class="inp" data-li="${ri}" data-gg="${gi}" data-lk="label" type="text" value="${esc(r.label)}" />
            <div class="money"><span class="sym">$</span>
              <input class="inp" data-li="${ri}" data-gg="${gi}" data-lk="amount" type="text"
                     inputmode="decimal" value="${esc(r.amount)}" /></div>
            <select class="inp sel" data-li="${ri}" data-gg="${gi}" data-lk="freq">
              ${EXP_FREQS.map((f)=>`<option value="${f.id}" ${r.freq===f.id?'selected':''}>${f.label}</option>`).join('')}
            </select>
            <button class="rm" data-lrm="${ri}" data-gg="${gi}" aria-label="Remove">&times;</button>
          </div>`).join('')}
      </div>
      <div class="rowbtns">
        <button class="btn ghost sm" data-ladd="${gi}">Add a line</button>
        <button class="skip" data-gmode="${gi}">Use one total instead</button>
      </div>`;
  return `<div class="gcard open">${head}<div class="gcbody">${nameField}${body}</div></div>`;
}

function debtPanel() {
  const lines = debtLines();
  if (!lines.length) return hiddenDebtRisk() ? `
    <div class="debtpanel">${stepHead(4)}
      <p class="helper" style="margin:0">If you have a mortgage or car payment inside a category
        you entered as one total, itemise it and it'll show here.</p></div>` : '';

  const total = lines.reduce((t,l)=>t+l.amount,0);
  const secured = lines.filter((l)=>l.secured);
  const securedSum = secured.reduce((t,l)=>t+l.amount,0);
  const otherSum = total - securedSum;
  const names = secured.map((l)=>l.label.toLowerCase()
    .replace('car payment','a car').replace('mortgage','a home'));
  const extra = num(state.extraDebt);

  return `
    <div class="debtpanel">
      ${stepHead(4)}
      <p class="helper" style="margin:0">These are already counted above. Here's what they come
        to, and what happens when they end.</p>
      <div class="debtlist">
        ${lines.map((l)=>`<div class="dline"><span>${esc(l.label)}</span><span class="v">${usd(l.amount)}</span></div>`).join('')}
        <div class="dline tot"><span>Each month</span><span class="v">${usd(total)}</span></div>
      </div>
      ${(securedSum && otherSum) ? `<p class="splitnote">Most of this came with something you're
        using &mdash; ${names.join(' and ')}. <b>${usd(otherSum)}</b> is other borrowing.</p>`:''}
      <p class="tipline">Unlike rent, these have finish lines. As each one ends, that payment
        comes back to you.</p>
      <div class="field">
        <label for="extradebt">Pay extra, on top of these? <span class="opt">Optional</span></label>
        <div class="money" style="max-width:220px"><span class="sym">$</span>
          <input class="inp" id="extradebt" type="text" inputmode="decimal" placeholder="A month"
                 value="${esc(state.extraDebt)}" /></div>
        <p class="helper">${extra
          ? `${usd(total)} in minimums plus ${usd(extra)} extra &mdash; ${usd(total+extra)} a month toward debt.`
          : 'The payments above are what you already owe each month. Anything here is on top of them.'}</p>
      </div>
    </div>`;
}

function s3() {
  const t = expTotal(), sp = expSplit(), inc = incomeTotals().plan;
  const pct = t ? Math.round((sp.fixed/t)*100) : 0;
  const here = new Set(state.exp.map((g) => g.id));
  const spare = CATALOG.filter((g) => !here.has(g.id));
  return `
    ${stepHead(3)}
    <div class="sechead">
      <p class="helper" style="margin:0">Open a category to itemise it, or just put in one total.
        Only fill in what you actually spend on.</p>
      ${t?`<span class="sectot">${usd(t)}<small>a month</small></span>`:''}
    </div>
    ${state.exp.map(groupCard).join('')}
    <div class="addcat">
      <button class="btn ghost sm" data-cattog="1">${state.addingCat?'Never mind':'+ Add a category'}</button>
      ${state.addingCat ? `<div class="examples">
        <p class="label">Add one of these, or name your own</p>
        <div class="chips">
          ${spare.map((g)=>`<button class="chip" data-catpick="${g.id}">${esc(g.name)}</button>`).join('')}
          <button class="chip" data-catadd="1">Something else</button>
        </div></div>`:''}
    </div>
    ${t?`<div class="splitbar">
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p>Roughly <b>${usd(sp.fixed)} is locked in</b> and <b>${usd(sp.varies)} has give in it</b>.</p>
    </div>
    <p class="tipline"><b>${usd(t)} a month goes out.</b>${inc?` That's ${Math.round((t/inc)*100)}% of your planning income.`:''}</p>`:''}
    ${debtPanel()}`;
}
const s3ok = () => expTotal() > 0;

/* ======================================== screen 4: where what's left goes */
/* A budget line, not a savings plan: you say what goes in each month and it
   tells you what that adds up to over a year. Reaching a target is a returns
   question, and we don't ask for a rate of return — so we don't answer it. */
function destination({ name, sub, value, key, gi, done }) {
  const monthly = num(value);
  const note = done
    ? 'Already where you want it — nothing assigned monthly.'
    : monthly ? `${usd(monthly * 12)} over a year.` : '';
  const attr = gi !== undefined ? `data-alloc="${gi}"` : `data-sav="${key}"`;
  return `
    <div class="dest ${key === 'emergency' ? 'must' : ''} ${done ? 'done' : ''}">
      <div class="dhead"><div>
        <div class="dname">${esc(name)}</div>
        ${sub ? `<div class="dsub">${sub}</div>` : ''}
      </div></div>
      ${done ? '' : `<div class="money"><span class="sym">$</span>
        <input class="inp" ${attr} type="text" inputmode="decimal" placeholder="A month"
               value="${esc(value)}" /></div>`}
      ${note ? `<p class="eta">${note}</p>` : ''}
    </div>`;
}

function s4() {
  const inc = incomeTotals().plan;
  const out = expTotal() + num(state.extraDebt);
  const left = unassigned();
  const before = inc - out;
  const gs = filledGoals();

  const box = `
    <div class="leftbox ${left < 0 ? 'over' : ''}">
      <div class="k">${left < 0 ? 'Over-assigned by' : 'Left to assign'}</div>
      <div class="v">${usd(Math.abs(left))}</div>
      <div class="n">${usd(inc)} in, ${usd(out)} out${savingTotal() ? `, ${usd(savingTotal())} to saving` : ''}.</div>
    </div>`;

  /* emergency fund first — step 5's point is that it's a commitment, not a leftover */
  const emergency = `
    ${stepHead(5)}
    <p class="helper" style="margin:0 0 9px">Treat this as a bill you owe yourself, not
      whatever happens to be left at the end of the month.</p>
    ${destination({ name:'Emergency fund', key:'emergency',
      sub:'Somewhere for the unexpected to land besides a credit card',
      value:state.emergency, done:state.emergencyDone })}
    <label class="varies"><input type="checkbox" id="emdone" ${state.emergencyDone?'checked':''} />
      This is already where I want it</label>
    ${state.emergencyDone || !expTotal() ? '' : `<p class="helper">For scale: six months of
      the expenses you entered would be about ${usd(expTotal()*6)}.</p>`}`;

  /* the goals written in step 1 come back here, which is the whole point of
     asking for them first */
  /* A debt-payoff goal is not a third place to put money — the minimum is
     already in the budget and the extra is set in step 4. Say so here rather
     than guessing which goals are about debt from their wording. */
  const dbt = debtLines().reduce((t, l) => t + l.amount, 0);
  const goalBlock = !gs.length ? '' : `
    <p class="label secgap">Your goals from the start</p>
    ${dbt ? `<p class="helper" style="margin:0 0 10px">Clearing a debt? That's already
      counted &mdash; ${usd(dbt)} of payments in your budget${num(state.extraDebt)
        ? ` plus the ${usd(num(state.extraDebt))} extra you set in step 4`
        : `, and step 4 is where you add extra`}. Use this for goals that need money set aside.</p>` : ''}
    ${gs.map((g, i) => destination({ name:g.text, key:'goal'+i, gi:i,
      value:state.goalAlloc[i] || '' })).join('')}`;

  const longTerm = `
    ${stepHead(6)}
    <p class="helper" style="margin:0 0 9px">Retirement, education, anything on a longer
      timeline.</p>
    ${state.longTerm.map((r, i) => `
      <div class="dest">
        <div class="dhead" style="gap:8px">
          <input class="inp" data-lt="${i}" data-ltk="label" type="text"
                 placeholder="What for?" value="${esc(r.label)}" />
          ${state.longTerm.length > 1 ? `<button class="rm" data-ltrm="${i}" aria-label="Remove">&times;</button>` : ''}
        </div>
        <div class="money"><span class="sym">$</span>
          <input class="inp" data-lt="${i}" data-ltk="amount" type="text" inputmode="decimal"
                 placeholder="A month" value="${esc(r.amount)}" /></div>
      </div>`).join('')}
    <div class="rowbtns"><button class="btn ghost sm" data-ltadd="1">Add another</button></div>`;

  const verdict = left < 0
    ? `<p class="tipline">You've assigned ${usd(-left)} more than you have. That's useful
        information, not a verdict &mdash; the last screen has the levers.</p>`
    : (before > 0 && left === 0 && savingTotal())
      ? `<p class="tipline">Every dollar has a job now.</p>` : '';

  return `${box}${emergency}${goalBlock}${longTerm}${verdict}`;
}
const s4ok = () => true;

/* =================================================== screen 5: the budget */

/* Two validated hues. The categorical palette can only carry two slots at
   full separation (see the validator run), so the ring is used ONLY for the
   two-way fixed/variable split. Categories get ranked bars in a single hue,
   where identity comes from the label, not the colour. */
const C_FIXED = '#00618C';
const C_VARIES = '#DD9E00';
const C_BAR = '#1B6D5F';

function whereItGoes() {
  const rows = state.exp.filter((g) => groupTotal(g) > 0)
    .map((g) => ({ name: g.name || 'Other', v: groupTotal(g) }));
  if (num(state.extraDebt)) rows.push({ name: 'Extra toward debt', v: num(state.extraDebt) });
  if (savingTotal()) rows.push({ name: 'Saving', v: savingTotal() });
  const left = unassigned();
  if (left > 0) rows.push({ name: 'Not yet assigned', v: left, soft: true });
  return rows.sort((x, y) => y.v - x.v);
}

function barsView() {
  const rows = whereItGoes();
  if (!rows.length) return '';
  const max = rows[0].v;
  const all = rows.reduce((t, r) => t + r.v, 0);
  return `
    <div class="bars" role="img" aria-label="Where your money goes, largest first">
      ${rows.map((r) => `
        <div class="barrow">
          <span class="bl">${esc(r.name)}</span>
          <span class="bt"><i class="${r.soft ? 'soft' : ''}" style="width:${Math.max(2, (r.v / max) * 100)}%"></i></span>
          <span class="bv">${usd(r.v)}<small>${Math.round((r.v / all) * 100)}%</small></span>
        </div>`).join('')}
    </div>`;
}

function typeView() {
  const sp = expSplit();
  const tot = sp.fixed + sp.varies;
  if (!tot) return '';
  const R = 52, C = 2 * Math.PI * R;
  const gap = 4;                                   /* surface gap between segments */
  const fx = (sp.fixed / tot) * C;
  return `
    <div class="donutwrap">
      <svg class="donut" viewBox="0 0 130 130" role="img"
           aria-label="Fixed ${usd(sp.fixed)}, variable ${usd(sp.varies)}">
        <circle cx="65" cy="65" r="${R}" fill="none" stroke="${C_VARIES}" stroke-width="20" />
        <circle cx="65" cy="65" r="${R}" fill="none" stroke="${C_FIXED}" stroke-width="20"
                stroke-dasharray="${Math.max(0, fx - gap)} ${C - Math.max(0, fx - gap)}"
                transform="rotate(-90 65 65)" stroke-linecap="butt" />
        <text x="65" y="59" text-anchor="middle" class="dnum">${usd(tot)}</text>
        <text x="65" y="72" text-anchor="middle" class="dsub">in expenses</text>
        <text x="65" y="82" text-anchor="middle" class="dsub">a month</text>
      </svg>
      <ul class="legend">
        <li><span class="sw" style="background:${C_FIXED}"></span>
          <span class="ln">Fixed<small>locked in</small></span>
          <span class="lv">${usd(sp.fixed)} &middot; ${Math.round((sp.fixed / tot) * 100)}%</span></li>
        <li><span class="sw" style="background:${C_VARIES}"></span>
          <span class="ln">Variable<small>some give</small></span>
          <span class="lv">${usd(sp.varies)} &middot; ${Math.round((sp.varies / tot) * 100)}%</span></li>
      </ul>
      <p class="helper">Categories you entered as a single total are counted by their
        main type, so this split is approximate.</p>
    </div>`;
}

function statement() {
  const gs = filledGoals();
  const left = unassigned();
  const inc = state.income.filter((r) => r.varies ? num(r.low) : num(r.amount));
  const sec = (title, body) => `<div class="stsec"><h3>${title}</h3>${body}</div>`;
  const line = (k, v, sub) => `<div class="stline"><span>${esc(k)}${
    sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="v">${v}</span></div>`;

  return `
    <div class="statement">
      ${gs.length ? sec('Goals', gs.map((g, i) => line(g.text,
        num(state.goalAlloc[i]) ? usd(num(state.goalAlloc[i])) + '/mo' : '—',
        num(state.goalAlloc[i]) ? usd(num(state.goalAlloc[i]) * 12) + ' over a year' : ''
      )).join('')) : ''}

      ${inc.length ? sec('Money in', inc.map((r) => line(r.label || 'Income',
        usd(rowMonthly(r, false)) + '/mo',
        r.varies
          ? `varies · ${usd(num(r.low))}–${usd(num(r.high))} ${freqBy(r.freq).label.toLowerCase()}, planned at the low end`
          : freqBy(r.freq).label.toLowerCase()))
        .join('') + line('Total in', usd(incomeTotals().plan) + '/mo')) : ''}

      ${(expTotal() || num(state.extraDebt)) ? sec('Money out', state.exp.filter((g) => groupTotal(g) > 0).map((g) => `
        <div class="stgroup">
          ${line(g.name || 'Other', usd(groupTotal(g)) + '/mo')}
          ${g.mode === 'items' ? g.items.filter((r) => num(r.amount)).map((r) =>
            `<div class="stitem"><span>${esc(r.label)}</span><span>${usd(lineMonthly(r))}${
              r.freq !== 'monthly' ? ` <small>(${esc(r.amount)} ${expFreqBy(r.freq).label.toLowerCase()})</small>` : ''
            }</span></div>`).join('') : '<div class="stitem"><span>entered as one total</span><span></span></div>'}
        </div>`).join('') + (num(state.extraDebt) ? line('Extra toward debt', usd(num(state.extraDebt)) + '/mo') : '')
        + line('Total out', usd(expTotal() + num(state.extraDebt)) + '/mo')) : ''}

      ${savingTotal() ? sec('Saving', [
        num(state.emergency) ? line('Emergency fund', usd(num(state.emergency)) + '/mo') : '',
        state.emergencyDone ? line('Emergency fund', 'already funded') : '',
        ...gs.map((g, i) => num(state.goalAlloc[i]) ? line(g.text, usd(num(state.goalAlloc[i])) + '/mo') : ''),
        ...state.longTerm.map((r) => num(r.amount) ? line(r.label || 'Saving', usd(num(r.amount)) + '/mo') : ''),
        line('Total saving', usd(savingTotal()) + '/mo'),
      ].join('')) : ''}

      ${(incomeTotals().plan || expTotal()) ? sec(left < 0 ? 'Over-assigned' : 'Left unassigned',
        line(left < 0 ? 'Planned beyond what comes in' : 'Money in, minus everything planned',
             usd(Math.abs(left)) + '/mo')) : ''}
    </div>`;
}

/* The seven steps are the spine of the lesson, so the recap reports what is
   actually there rather than ticking everything. Three states: done, nothing
   to enter (debt, legitimately), and not filled in — the last one links back. */
const SCREEN_OF_STEP = [0, 1, 2, 2, 3, 3, 4];

function stepStatus(n) {
  const plural = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
  if (n === 1) {
    const g = filledGoals().length;
    return g ? { done: true, note: plural(g, 'goal') + ' written down' } : {};
  }
  if (n === 2) {
    const t = incomeTotals().plan;
    return t ? { done: true, note: usd(t) + ' a month to plan with' } : {};
  }
  if (n === 3) {
    const t = expTotal();
    if (!t) return {};
    const sp = expSplit();
    return { done: true, note: `${usd(t)} a month · ${usd(sp.fixed)} fixed, ${usd(sp.varies)} variable` };
  }
  if (n === 4) {
    const d = debtLines(), extra = num(state.extraDebt);
    if (d.length || extra) {
      const bits = [];
      if (d.length) bits.push(plural(d.length, 'payment') + ' in the budget');
      if (extra) bits.push(usd(extra) + ' extra');
      return { done: true, note: bits.join(' · ') };
    }
    return { none: true, note: 'no debt payments entered' };
  }
  if (n === 5) {
    if (state.emergencyDone) return { done: true, note: 'already funded' };
    const e = num(state.emergency);
    return e ? { done: true, note: usd(e) + ' a month' } : {};
  }
  if (n === 6) {
    const g = state.goals.reduce((t, _, i) => t + num(state.goalAlloc[i]), 0);
    const lt = state.longTerm.reduce((t, r) => t + num(r.amount), 0);
    return g + lt ? { done: true, note: usd(g + lt) + ' a month toward goals' } : {};
  }
  const w = state.reviewWhen.trim();
  return w ? { done: true, note: 'checking back ' + w.toLowerCase() } : {};
}

function recap() {
  return `
    <p class="label secgap">The seven steps</p>
    <ul class="recap">${STEP_NAMES.map((nm, k) => {
      const n = k + 1, st = stepStatus(n), to = SCREEN_OF_STEP[k];
      const seen = !!state.seen[to];
      const done = !!st.done, none = !!st.none && seen;
      const mark = done ? '<span class="tick">&#10003;</span>'
        : none ? '<span class="dash">&ndash;</span>'
        : '<span class="open"></span>';
      const tail = done || none
        ? `<small>${esc(st.note)}</small>`
        : n === 7 ? '<small>set a check-back date below</small>'
        : `<button class="jumpstep" data-step="${to}">${seen ? 'add it' : 'go there'}</button>`;
      return `<li class="${done ? '' : 'undone'}">${mark}<span>${n}. ${esc(nm)}${tail}</span></li>`;
    }).join('')}</ul>`;
}

function s5() {
  const left = unassigned();
  const anything = filledGoals().length || incomeTotals().plan || expTotal() || savingTotal();

  /* No figures yet means no chart — a toggle over an empty space is worse than
     nothing. The step list below still tells them where to go. */
  const chart = whereItGoes().length ? `
    <p class="label secgap">Where your money goes</p>
    <div class="toggle">
      <button class="tg ${state.chartMode === 'cat' ? 'on' : ''}" data-cm="cat">By category</button>
      <button class="tg ${state.chartMode === 'type' ? 'on' : ''}" data-cm="type">Fixed vs variable</button>
    </div>
    ${state.chartMode === 'cat' ? barsView() : (typeView() || '<p class="helper">Enter some expenses to see this split.</p>')}` : '';
  const levers = left < 0 ? `
    <p class="label secgap">If the number is below zero</p>
    <p class="helper" style="margin:0 0 10px">The gap is information, not a verdict. Pick one
      lever to test.</p>
    <div class="debtlist">
      <div class="dline"><span><b>Flexible costs</b><br /><span class="dsub">You have ${usd(expSplit().varies)} with give in it.</span></span></div>
      <div class="dline"><span><b>Goal timing</b><br /><span class="dsub">Change an amount or push a target date out.</span></span></div>
      <div class="dline"><span><b>Recurring costs</b><br /><span class="dsub">Review a bill, plan or subscription.</span></span></div>
      <div class="dline"><span><b>Income and support</b><br /><span class="dsub">Explore work, benefits or assistance.</span></span></div>
    </div>` : '';

  const covered = recap();

  return `
    ${sheetMarkup()}

    ${chart}

    ${levers}

    ${anything ? `
      <p class="label secgap">Everything together</p>
      <button class="btn ghost sm" data-showall="1">${state.showAll ? 'Hide the detail' : 'See every line'}</button>
      ${state.showAll ? statement() : ''}` : ''}

    ${covered}

    <div class="field secgap">
      <label for="reviewwhen">When will you check back on this?</label>
      <input class="inp" id="reviewwhen" type="text" style="max-width:300px"
             placeholder="Weekly, or the 1st of the month" value="${esc(state.reviewWhen)}" />
      <p class="helper">Weekly while income moves around or the plan is new; monthly once the
        pattern is steady.</p>
    </div>

    <div class="rowbtns">
      <button class="btn ghost sm" data-print="1">Print or save as PDF</button>
    </div>
    <p class="helper">Nothing here was saved or sent anywhere. Closing this tab clears it.</p>`;
}

/* ---------------------------------------------------------------- the sheet */
function sheetMarkup() {
  const t = incomeTotals(), sp = expSplit(), left = unassigned();
  const gs = filledGoals();
  /* Names only. The monthly figure for goals is one row down in the ledger —
     printing it in both places is the same fact twice. */
  const goalBlock = !gs.length ? '' : `
    <div class="line" style="border-bottom:0;padding-bottom:2px"><span style="font-weight:600">Goals</span></div>
    <div style="margin:0 0 8px">${gs.map((g,i)=>`
      <div class="goalline"><span class="gdot"></span>
        <span class="gtxt">${esc(g.text)}</span></div>`).join('')}</div>`;

  const hasDebt = debtLines().length > 0 || num(state.extraDebt) > 0;
  const rows = [
    ['After-tax income', t.plan ? usd(t.plan) : null,
      t.anyVaries && t.upside ? `up to ${usd(t.plan + t.upside)} in a good month` : null],
    ['Fixed expenses', sp.fixed ? usd(sp.fixed) : null],
    ['Variable expenses', sp.varies ? usd(sp.varies) : null],
    hasDebt ? ['Extra toward debt', num(state.extraDebt) ? usd(num(state.extraDebt)) : null] : null,
    ['Emergency saving', num(state.emergency) ? usd(num(state.emergency)) : null],
    ['Goals', goalAllocTotal() ? usd(goalAllocTotal()) : null],
    ['Further saving', longTermTotal() ? usd(longTermTotal()) : null],
  ].filter(Boolean).map(([k,v,sub]) => `
    <div class="line ${v?'':'pending'}">
      <span>${k}${sub?`<small class="sub">${sub}</small>`:''}</span>
      <span class="v">${v||'&mdash;'}</span>
    </div>`).join('');

  return `
    <div class="sheet">
      <h2>Your budget sheet</h2>
      <div class="body">
        ${goalBlock}${rows}
        <div class="gap ${left<0?'over':''}">
          <div class="k">${left<0?'Over-assigned':'Unassigned money'}</div>
          <div class="v">${t.plan?usd(left):'&mdash;'}</div>
        </div>
        <p class="note">Income minus everything you've planned. Nothing here is saved or sent anywhere.</p>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ render */
const VIEWS = [s1, s2, s3, s4, s5];
const OKS   = [s1ok, s2ok, s3ok, s4ok, () => true];

/* the pinned bar shows whichever number matters on this screen */
function summary() {
  const bar = $('sumbar');
  const inc = incomeTotals().plan;
  const spec = [
    null,
    inc ? { lab:'Monthly income', v:inc } : null,
    inc || expTotal() ? { lab:'Left after expenses', v:inc - expTotal() - num(state.extraDebt) } : null,
    inc ? { lab:unassigned()<0?'Over-assigned by':'Left to assign', v:unassigned() } : null,
    null,
  ][state.i];

  if (!spec) { bar.hidden = true; state.drawer = false; return; }
  bar.hidden = false;
  $('sumlab').textContent = spec.lab;
  const n = $('sumnum');
  n.textContent = usd(Math.abs(spec.v));
  n.classList.toggle('over', spec.v < 0);
  $('sumchev').innerHTML = state.drawer ? '&#9662;' : '&#9652;';
  const d = $('sumdrawer');
  d.hidden = !state.drawer;
  if (state.drawer) d.innerHTML = sheetMarkup();
}

function render() {
  state.seen[state.i] = true;
  const s = SCREENS[state.i];
  const here = SCREENS[state.i].steps;
  $('track').innerHTML = STEP_NAMES.map((_,k) => {
    const n = k+1;
    return `<i class="${here.includes(n)?'now':(n<here[0]?'done':'')}"></i>`;
  }).join('');
  $('stepcount').textContent = here.length>1
    ? `Steps ${here[0]}–${here[here.length-1]} of 7` : `Step ${here[0]} of 7`;

  const ok = OKS[state.i]();
  const last = state.i === SCREENS.length-1;
  $('panel').innerHTML = `
    <div class="stephead">
      ${here.length === 1 ? `<span class="snum">${here[0]}</span>` : ''}
      <h1>${esc(s.title)}</h1>
    </div>
    <p class="steplede">${esc(s.lede)}</p>
    <div class="rule"></div>
    ${VIEWS[state.i]()}
    <div class="nav">
      ${state.i>0 ? '<button class="btn ghost sm" data-go="back">Back</button>':'<span></span>'}
      <div class="navend">
        ${!last && !ok ? '<button class="skip" data-go="next">Skip for now</button>':''}
        ${last ? '' : `<button class="btn" data-go="next" ${ok?'':'disabled'}>Continue</button>`}
      </div>
    </div>`;

  /* the sheet lives in the sidebar on desktop, in the pinned drawer on phones */
  $('aside').innerHTML = state.i === SCREENS.length-1 ? '' : sheetMarkup();
  summary();
  bindInputs();
}

/* Amount fields feed several derived figures at once, so they re-render and
   put the caret back. Text-only fields skip that to avoid the churn. */
function liveAmount(el, write) {
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
    write(el.value);
    if (el.tagName === 'SELECT') return render();
    const pos = el.selectionStart;
    const sel = el.dataset.k || el.id
      ? (el.id ? '#'+el.id : null) : null;
    const path = el.getAttribute('data-path') || null;
    render();
    const again = sel ? document.querySelector(sel)
      : path ? document.querySelector(`[data-path="${path}"]`) : null;
    if (again) { again.focus(); try { again.setSelectionRange(pos,pos); } catch(e){} }
  });
}

function bindInputs() {
  /* goals — text only, so just refresh the sheet and the Continue state */
  document.querySelectorAll('[data-gi]').forEach((el) => {
    el.addEventListener('input', () => {
      state.goals[+el.dataset.gi][el.dataset.gk] = el.value;
      $('aside').innerHTML = sheetMarkup();
      const b = document.querySelector('[data-go="next"].btn');
      if (b) b.disabled = !s1ok();
    });
  });
  /* income */
  document.querySelectorAll('[data-ii]').forEach((el) => {
    el.setAttribute('data-path', `ii${el.dataset.ii}-${el.dataset.ik}`);
    liveAmount(el, (v) => { state.income[+el.dataset.ii][el.dataset.ik] = v; });
  });
  /* expense lines and group totals */
  document.querySelectorAll('[data-q]').forEach((el) => {
    el.setAttribute('data-path', `q${el.dataset.q}`);
    liveAmount(el, (v) => { state.exp[+el.dataset.q].quick = v; });
  });
  document.querySelectorAll('[data-li]').forEach((el) => {
    el.setAttribute('data-path', `l${el.dataset.gg}-${el.dataset.li}-${el.dataset.lk}`);
    if (el.dataset.lk === 'label') {
      el.addEventListener('input', () => {
        state.exp[+el.dataset.gg].items[+el.dataset.li].label = el.value;
      });
    } else {
      liveAmount(el, (v) => { state.exp[+el.dataset.gg].items[+el.dataset.li][el.dataset.lk] = v; });
    }
  });
  document.querySelectorAll('[data-cname]').forEach((el) => {
    el.addEventListener('input', () => {
      state.exp[+el.dataset.cname].name = el.value;
      const h = el.closest('.gcard').querySelector('.gcname');
      h.textContent = el.value || 'New category';
      h.classList.toggle('untitled', !el.value);
    });
  });
  /* saving */
  const xd = $('extradebt'); if (xd) liveAmount(xd, (v) => { state.extraDebt = v; });
  document.querySelectorAll('[data-sav]').forEach((el) => {
    el.setAttribute('data-path', 'sav-'+el.dataset.sav);
    liveAmount(el, (v) => { if (el.dataset.sav === 'emergency') state.emergency = v; });
  });
  document.querySelectorAll('[data-alloc]').forEach((el) => {
    el.setAttribute('data-path', 'alloc-'+el.dataset.alloc);
    liveAmount(el, (v) => { state.goalAlloc[+el.dataset.alloc] = v; });
  });
  document.querySelectorAll('[data-lt]').forEach((el) => {
    el.setAttribute('data-path', `lt${el.dataset.lt}-${el.dataset.ltk}`);
    if (el.dataset.ltk === 'label') {
      el.addEventListener('input', () => { state.longTerm[+el.dataset.lt].label = el.value; });
    } else {
      liveAmount(el, (v) => { state.longTerm[+el.dataset.lt].amount = v; });
    }
  });
  const rw = $('reviewwhen');
  if (rw) rw.addEventListener('input', () => { state.reviewWhen = rw.value; });
}

/* ----------------------------------------------------------------- events */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-add],[data-rm],[data-ex],[data-extog],'
    + '[data-iadd],[data-irm],[data-ivar],[data-gopen],[data-gmode],[data-ladd],[data-lrm],'
    + '[data-catadd],[data-cattog],[data-catpick],[data-grm],[data-ltadd],[data-ltrm],[data-cm],[data-showall],[data-print],[data-step],[data-go]');
  if (!el) return;
  const d = el.dataset;

  /* goals */
  if (d.add) { if (state.goals.length < MAX_GOALS) state.goals.push(blankGoal()); return render(); }
  if (d.rm !== undefined) {
    state.goals.splice(+d.rm,1); state.goalAlloc = {};
    if (!state.goals.length) state.goals.push(blankGoal());
    return render();
  }
  if (d.extog) { state.showExamples = !state.showExamples; return render(); }
  if (d.ex !== undefined) {
    let row = state.goals.find((g) => !g.text.trim());
    if (!row && state.goals.length < MAX_GOALS) { row = blankGoal(); state.goals.push(row); }
    if (row) row.text = EXAMPLES[+d.ex];
    return render();
  }
  /* income */
  if (d.iadd) { state.income.push(blankIncome()); return render(); }
  if (d.irm !== undefined) {
    state.income.splice(+d.irm,1);
    if (!state.income.length) state.income.push(blankIncome());
    return render();
  }
  if (d.ivar !== undefined) {
    const r = state.income[+d.ivar]; r.varies = !r.varies; return render();
  }
  /* expenses */
  if (d.cattog) { state.addingCat = !state.addingCat; return render(); }
  if (d.catpick) {
    const def = CATALOG.find((g) => g.id === d.catpick);
    if (def) state.exp.push(buildGroup(def, true));
    state.addingCat = false;
    return render();
  }
  if (d.catadd) { state.exp.push(blankCategory()); state.addingCat = false; return render(); }
  if (d.grm !== undefined) { state.exp.splice(+d.grm,1); return render(); }
  if (d.gopen !== undefined) { const g = state.exp[+d.gopen]; g.open = !g.open; return render(); }
  if (d.gmode !== undefined) {
    const g = state.exp[+d.gmode]; g.mode = g.mode==='quick'?'items':'quick'; return render();
  }
  if (d.ladd !== undefined) {
    state.exp[+d.ladd].items.push({ label:'', amount:'', freq:'monthly', t:'V', d:false });
    return render();
  }
  if (d.lrm !== undefined) { state.exp[+d.gg].items.splice(+d.lrm,1); return render(); }
  /* saving */
  if (d.cm) { state.chartMode = d.cm; return render(); }
  if (d.showall) { state.showAll = !state.showAll; return render(); }
  if (d.print) { state.showAll = true; render(); window.print(); return; }
  if (d.step !== undefined) { state.i = +d.step; window.scrollTo(0,0); return render(); }
  if (d.ltadd) { state.longTerm.push(blankLongTerm()); return render(); }
  if (d.ltrm !== undefined) { state.longTerm.splice(+d.ltrm,1); return render(); }
  /* nav */
  if (d.go === 'next') { state.i = Math.min(SCREENS.length-1, state.i+1); window.scrollTo(0,0); return render(); }
  if (d.go === 'back') { state.i = Math.max(0, state.i-1); window.scrollTo(0,0); return render(); }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'emdone') { state.emergencyDone = e.target.checked; render(); }
});

$('sumtap').addEventListener('click', () => { state.drawer = !state.drawer; summary(); });

render();
