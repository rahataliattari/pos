// Minimal in-browser stand-in for Dexie (IndexedDB wrapper), used ONLY by the standalone demo file so it runs
// with no internet and no library download. It implements just the calls the app makes. Data lives in memory
// and is mirrored to localStorage, so it survives closing the page. The real app keeps using real Dexie.
(function () {
  const clone = v => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  const cmp = (a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      a = [].concat(a); b = [].concat(b);
      for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmp(a[i], b[i]); if (c) return c; }
      return a.length - b.length;
    }
    if (typeof a === typeof b) return a < b ? -1 : a > b ? 1 : 0;
    return typeof a === 'number' ? -1 : 1;
  };
  const STORE = 'pos_demo_data_v1';

  class Coll {
    constructor(items, o = {}) { this.items = items; this.o = { filters: [], rev: false, off: 0, lim: Infinity, ...o }; }
    _with(p) { return new Coll(this.items, { ...this.o, ...p }); }
    reverse() { return this._with({ rev: !this.o.rev }); }
    filter(fn) { return this._with({ filters: [...this.o.filters, fn] }); }
    offset(n) { return this._with({ off: n }); }
    limit(n) { return this._with({ lim: n }); }
    _run() {
      let a = this.o.rev ? this.items.slice().reverse() : this.items.slice();
      for (const f of this.o.filters) a = a.filter(f);
      return a.slice(this.o.off, this.o.lim === Infinity ? undefined : this.o.off + this.o.lim);
    }
    async toArray() { return this._run().map(clone); }
    async first() { const r = this._with({ lim: 1 })._run(); return r.length ? clone(r[0]) : undefined; }
    async count() { return this._run().length; }
    async each(fn) { for (const r of this._run()) fn(clone(r)); }
  }

  class Where {
    constructor(table, idx) { this.t = table; this.idx = idx; }
    _key(row) {
      const i = this.idx;
      if (i[0] === '[') {
        const k = i.slice(1, -1).split('+').map(p => row[p]);
        return k.some(v => v == null) ? null : k;
      }
      return row[i] == null ? null : row[i];
    }
    _coll(pred) {
      const pk = this.t.pk;
      const arr = [];
      for (const row of this.t.rows.values()) { const k = this._key(row); if (k !== null && pred(k)) arr.push([k, row]); }
      arr.sort((x, y) => cmp(x[0], y[0]) || cmp(x[1][pk], y[1][pk]));
      return new Coll(arr.map(x => x[1]));
    }
    equals(v) { return this._coll(k => cmp(k, v) === 0); }
    between(lo, hi, incLo = true, incHi = false) {
      return this._coll(k => { const a = cmp(k, lo), b = cmp(k, hi); return (incLo ? a >= 0 : a > 0) && (incHi ? b <= 0 : b < 0); });
    }
  }

  class Table {
    constructor(db, name, spec) {
      this.db = db; this.name = name; this.rows = new Map(); this.counter = 0;
      const first = spec.split(',')[0].trim();
      this.auto = first.startsWith('++'); this.pk = first.replace('++', '');
    }
    _sorted() { return [...this.rows.values()].sort((a, b) => cmp(a[this.pk], b[this.pk])); }
    where(idx) { return new Where(this, idx); }
    async get(k) { const r = this.rows.get(k); return r ? clone(r) : undefined; }
    async bulkGet(ks) { return ks.map(k => { const r = this.rows.get(k); return r ? clone(r) : undefined; }); }
    async put(o) { const r = clone(o); this.rows.set(r[this.pk], r); this.db._dirty(); return r[this.pk]; }
    async add(o) {
      const r = clone(o);
      if (this.auto && r[this.pk] == null) r[this.pk] = ++this.counter;
      else if (this.rows.has(r[this.pk])) throw new Error('Key already exists: ' + r[this.pk]);
      this.rows.set(r[this.pk], r); this.db._dirty(); return r[this.pk];
    }
    async delete(k) { this.rows.delete(k); this.db._dirty(); }
    async count() { return this.rows.size; }
    offset(n) { return new Coll(this._sorted()).offset(n); }
    limit(n) { return new Coll(this._sorted()).limit(n); }
    toArray() { return new Coll(this._sorted()).toArray(); }
  }

  class Dexie {
    constructor(name) { this.name = name; this._t = {}; this._timer = null; }
    version() { return { stores: spec => { for (const n in spec) { this._t[n] = new Table(this, n, spec[n]); this[n] = this._t[n]; } return this; } }; }
    table(n) { return this._t[n]; }
    async open() {
      try {
        const raw = localStorage.getItem(STORE);
        if (raw) {
          const d = JSON.parse(raw);
          for (const n in d.tables) if (this._t[n]) { this._t[n].rows = new Map(d.tables[n].map(r => [r[this._t[n].pk], r])); this._t[n].counter = d.counters[n] || 0; }
        }
      } catch (e) { /* storage blocked: demo still works until the page is closed */ }
      return this;
    }
    _dirty() {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        try {
          const tables = {}, counters = {};
          for (const n in this._t) { tables[n] = [...this._t[n].rows.values()]; counters[n] = this._t[n].counter; }
          localStorage.setItem(STORE, JSON.stringify({ tables, counters }));
        } catch (e) {}
      }, 150);
    }
    async transaction(mode, ...args) {
      const fn = args.pop();
      const tabs = args.filter(a => a instanceof Table);
      const snap = tabs.map(t => [t, new Map(t.rows), t.counter]);
      try { return await fn(); }
      catch (e) { for (const [t, rows, c] of snap) { t.rows = rows; t.counter = c; } throw e; }
    }
  }
  window.Dexie = Dexie;
})();
