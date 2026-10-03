// ==========================================================
// 🔬 indexLab.js — API ของหน้า "Indexing" (เฉพาะผู้ดูแลระบบ)
// ----------------------------------------------------------
// Lab PostgreSQL ใช้ 2 database (pg_with_index / pg_no_index)
// ที่นี่ใช้ MongoDB ตัวเดียว แล้วรัน query เดียวกัน 2 แบบ:
//   • "มี index"    → ให้ query planner เลือก index เอง (หรือบังคับด้วย hint)
//   • "ไม่มี index" → บังคับ .hint({ $natural: 1 }) = อ่านทุก document (COLLSCAN ≈ Seq Scan)
// แล้วอ่าน explain('executionStats') มาเทียบกัน (≈ EXPLAIN ANALYZE)
// ==========================================================
const express = require('express');
const mongoose = require('mongoose');
const { Order, Product, User, Booking, Simulation } = require('./models');

const router = express.Router();
const D = (s) => new Date(`${s}T00:00:00.000Z`);

// ชุดทดสอบ — อิงจาก 01-explain.sql, 04-pitfalls.sql, 05-composite.sql, 06-workshop.sql
const TESTS = [
    {
        id: 'customer-history', group: 'ใช้งานจริงในระบบ',
        title: 'ประวัติการซื้อของลูกค้า #42',
        sql: 'SELECT * FROM orders WHERE customer_id = 42 ORDER BY order_date DESC LIMIT 20',
        build: () => Order.find({ customerId: 42 }).sort({ orderDate: -1 }).limit(20),
        expect: 'ใช้ idx_order_cust_date ได้ทั้งการค้นและการเรียงลำดับ ไม่ต้อง SORT ในหน่วยความจำ'
    },
    {
        id: 'exact-date', group: 'Lab 01',
        title: 'ยอดขายวันเดียว (exact match)',
        sql: "SELECT * FROM orders WHERE order_date = '2026-09-10'",
        build: () => Order.find({ orderDate: D('2026-09-10') }),
        expect: 'ใช้ idx_order_date อ่านเฉพาะ ~0.3% ของข้อมูล'
    },
    {
        id: 'range-7d', group: 'Lab 01',
        title: 'ช่วงแคบ 7 วัน (≈2%)',
        sql: "SELECT * FROM orders WHERE order_date BETWEEN '2026-09-01' AND '2026-09-07'",
        build: () => Order.find({ orderDate: { $gte: D('2026-09-01'), $lte: D('2026-09-07') } }),
        expect: 'index ช่วยมาก เพราะเลือกข้อมูลแค่ส่วนน้อย'
    },
    {
        id: 'range-6m', group: 'Lab 01',
        title: 'ช่วงกว้าง 6 เดือน (≈50%) — index ยังช่วยไหม?',
        sql: "SELECT * FROM orders WHERE order_date BETWEEN '2026-03-01' AND '2026-08-31'",
        build: () => Order.find({ orderDate: { $gte: D('2026-03-01'), $lte: D('2026-08-31') } }),
        expect: 'ต้องอ่านครึ่งหนึ่งของข้อมูลอยู่ดี index อาจไม่เร็วกว่า (หรือช้ากว่า) COLLSCAN'
    },
    {
        id: 'pending-since', group: 'Workshop',
        title: 'รายการค้างชำระตั้งแต่ 1 ก.ย. (composite status + date)',
        sql: "SELECT * FROM orders WHERE status = 'pending' AND order_date >= '2026-09-01' ORDER BY order_date",
        build: () => Order.find({ status: 'pending', orderDate: { $gte: D('2026-09-01') } }).sort({ orderDate: 1 }),
        expect: 'ใช้ idx_order_status_date — field เท่ากับ (status) อยู่หน้า field ช่วง (orderDate)'
    },
    {
        id: 'pitfall-function', group: 'Lab 04 — มี index แต่ไม่ถูกใช้',
        title: '❌ ครอบ field ด้วย function ($month / $dayOfMonth)',
        sql: 'SELECT * FROM orders WHERE EXTRACT(MONTH FROM order_date) = 9 AND EXTRACT(DAY FROM order_date) = 10',
        build: () => Order.find({ $expr: { $and: [
            { $eq: [{ $month: '$orderDate' }, 9] },
            { $eq: [{ $dayOfMonth: '$orderDate' }, 10] }
        ] } }),
        expect: 'ทั้ง 2 แบบได้ COLLSCAN — ต้องเขียนเป็นช่วงวันที่ตรง ๆ แทน'
    },
    {
        id: 'pitfall-noindex', group: 'Lab 04 — มี index แต่ไม่ถูกใช้',
        title: '❌ ค้น field ที่ไม่ได้ทำ index (amount)',
        sql: 'SELECT * FROM orders WHERE amount > 45000',
        build: () => Order.find({ amount: { $gt: 45000 } }),
        expect: 'ไม่มี index บน amount → COLLSCAN ทั้งคู่ (ตั้งใจไม่ทำ เพราะไม่ค่อยถูกค้น)'
    },
    {
        id: 'pitfall-leftmost', group: 'Lab 05 — Leftmost rule',
        title: '⚠️ บังคับใช้ composite แต่ข้าม field ซ้ายสุด',
        sql: "SELECT * FROM orders WHERE order_date = '2026-09-10'  -- hint: idx_order_cust_date",
        build: () => Order.find({ orderDate: D('2026-09-10') }),
        hint: 'idx_order_cust_date',
        expect: 'ต้องไล่อ่าน key ทั้ง index (keysExamined ≈ ทั้งหมด) เพราะไม่ได้ระบุ customerId'
    },
    {
        id: 'login-or', group: 'ใช้งานจริงในระบบ',
        title: 'Login ด้วยอีเมลหรือ username ($or)',
        sql: "SELECT * FROM users WHERE email = 'x@y.com' OR username = 'x@y.com'",
        build: () => User.find({ $or: [{ email: 'customer@example.com' }, { username: 'customer@example.com' }] }),
        expect: 'แต่ละเงื่อนไขใน $or ใช้ index ของตัวเอง (OR → IXSCAN × 2)'
    }
];

// ดึงชื่อ stage จาก winningPlan (รองรับทั้งแบบ classic และ SBE ของ MongoDB 7+)
function planStages(plan) {
    if (!plan || typeof plan !== 'object') return [];
    const out = [];
    if (plan.stage) out.push(plan.indexName ? `${plan.stage} (${plan.indexName})` : plan.stage);
    if (plan.queryPlan) out.push(...planStages(plan.queryPlan));
    if (plan.inputStage) out.push(...planStages(plan.inputStage));
    if (Array.isArray(plan.inputStages)) plan.inputStages.forEach(p => out.push(...planStages(p)));
    return out;
}

async function runExplain(query, hint) {
    if (hint) query = query.hint(hint);
    const t0 = process.hrtime.bigint();
    let ex = await query.explain('executionStats');
    const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
    if (Array.isArray(ex)) ex = ex[0];
    const s = ex.executionStats || {};
    const stages = planStages(ex.queryPlanner && ex.queryPlanner.winningPlan);
    return {
        stages,
        usedIndex: stages.some(st => /^(IXSCAN|COUNT_SCAN|DISTINCT_SCAN|EXPRESS_IXSCAN)/.test(st)),
        nReturned: s.nReturned,
        totalKeysExamined: s.totalKeysExamined,
        totalDocsExamined: s.totalDocsExamined,
        executionTimeMillis: s.executionTimeMillis,
        wallMs: Math.round(wallMs * 10) / 10
    };
}

// GET /api/index-lab/tests — รายการชุดทดสอบ
router.get('/tests', (req, res) => {
    res.json(TESTS.map(({ build, ...t }) => t));
});

// POST /api/index-lab/explain { testId } — รัน query เดียวกันแบบมี/ไม่มี index แล้วเทียบ
router.post('/explain', async (req, res) => {
    try {
        const test = TESTS.find(t => t.id === req.body.testId);
        if (!test) return res.status(404).json({ message: 'ไม่พบชุดทดสอบนี้' });

        const withIndex = await runExplain(test.build(), test.hint);
        const noIndex = await runExplain(test.build(), { $natural: 1 });
        const a = withIndex.executionTimeMillis, b = noIndex.executionTimeMillis;
        const speedup = a > 0 ? Math.round((b / a) * 10) / 10 : (b > 0 ? `>${b}` : null);

        res.json({ id: test.id, title: test.title, sql: test.sql, expect: test.expect, withIndex, noIndex, speedup });
    } catch (error) {
        res.status(500).json({ message: 'รัน explain ไม่สำเร็จ', error: error.message });
    }
});

// GET /api/index-lab/indexes — index ทุกตัว + ขนาด + จำนวนครั้งที่ถูกใช้ (≈ 02-size.sql + pg_stat_user_indexes)
router.get('/indexes', async (req, res) => {
    try {
        const result = [];
        for (const M of [Order, Product, User, Booking, Simulation]) {
            const coll = M.collection;
            const [stats] = await coll.aggregate([{ $collStats: { storageStats: {} } }]).toArray().catch(() => [null]);
            const usage = await coll.aggregate([{ $indexStats: {} }]).toArray().catch(() => []);
            const indexes = await coll.indexes().catch(() => []);
            const ss = (stats && stats.storageStats) || {};
            result.push({
                collection: coll.collectionName,
                count: ss.count ?? await M.estimatedDocumentCount(),
                dataSize: ss.size || 0,
                totalIndexSize: ss.totalIndexSize || 0,
                indexes: indexes.map(ix => {
                    const u = usage.find(x => x.name === ix.name);
                    return {
                        name: ix.name,
                        key: ix.key,
                        unique: !!ix.unique,
                        sparse: !!ix.sparse,
                        partial: ix.partialFilterExpression || null,
                        ttlSeconds: ix.expireAfterSeconds ?? null,
                        size: (ss.indexSizes && ss.indexSizes[ix.name]) || 0,
                        timesUsed: u ? Number(u.accesses.ops) : null
                    };
                })
            });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'ดึงข้อมูล index ไม่สำเร็จ', error: error.message });
    }
});

// GET /api/index-lab/cardinality — ความหลากหลายของค่าในแต่ละ field (≈ 07-choose-columns.sql STEP 1)
router.get('/cardinality', async (req, res) => {
    try {
        const fields = ['customerId', 'orderDate', 'productPid', 'province', 'status'];
        const total = await Order.estimatedDocumentCount();
        const out = [];
        for (const f of fields) {
            const [r] = await Order.aggregate([{ $group: { _id: `$${f}` } }, { $count: 'n' }]);
            out.push({ field: f, distinct: r ? r.n : 0 });
        }
        res.json({ total, fields: out });
    } catch (error) {
        res.status(500).json({ message: 'คำนวณ cardinality ไม่สำเร็จ', error: error.message });
    }
});

// POST /api/index-lab/insert-cost { n } — เวลา INSERT เมื่อมี index มากขึ้น (≈ 03-insert-cost.sql / 07 STEP 3)
// สร้าง collection ชั่วคราว 3 ชุด → insert ข้อมูลเท่ากัน → จับเวลา → ลบทิ้ง (ไม่กระทบข้อมูลจริง ≈ ROLLBACK)
router.post('/insert-cost', async (req, res) => {
    const n = Math.min(Math.max(parseInt(req.body.n, 10) || 20000, 1000), 50000);
    const db = mongoose.connection.db;
    const scenarios = [
        { name: 'ไม่มี index (มีแค่ _id)', indexes: [] },
        { name: 'index 3 ตัวแบบที่ใช้ในระบบ', indexes: [
            { key: { customerId: 1, orderDate: -1 } }, { key: { orderDate: 1 } }, { key: { status: 1, orderDate: 1 } }
        ] },
        { name: 'ทำ index ทุก field (7 ตัว)', indexes: [
            { key: { customerId: 1, orderDate: -1 } }, { key: { orderDate: 1 } }, { key: { status: 1, orderDate: 1 } },
            { key: { amount: 1 } }, { key: { province: 1 } }, { key: { orderNo: 1 } }, { key: { productPid: 1 } }
        ] }
    ];
    const docs = Array.from({ length: n }, (_, i) => ({
        orderNo: `bulk-${i}`,
        orderDate: new Date(Date.UTC(2025, 8, 25) + Math.floor(Math.random() * 366) * 86400000),
        customerId: Math.floor(Math.random() * 10000) + 1,
        productPid: 1 + Math.floor(Math.random() * 13),
        amount: Math.round(Math.random() * 4000000) / 100,
        status: 'paid',
        province: 'กรุงเทพฯ'
    }));

    const results = [];
    try {
        for (const [i, sc] of scenarios.entries()) {
            const name = `tmp_insert_cost_${Date.now()}_${i}`;
            await db.createCollection(name);
            const coll = db.collection(name);
            try {
                if (sc.indexes.length) await coll.createIndexes(sc.indexes);
                const copy = docs.map(d => ({ ...d })); // insertMany เติม _id ลง object จึงต้อง copy ใหม่ทุกรอบ
                const t0 = process.hrtime.bigint();
                await coll.insertMany(copy, { ordered: false });
                const ms = Number(process.hrtime.bigint() - t0) / 1e6;
                const [st] = await coll.aggregate([{ $collStats: { storageStats: {} } }]).toArray().catch(() => [null]);
                results.push({
                    scenario: sc.name,
                    indexCount: sc.indexes.length + 1,
                    ms: Math.round(ms),
                    totalIndexSize: st ? st.storageStats.totalIndexSize : null
                });
            } finally {
                await coll.drop().catch(() => {});
            }
        }
        res.json({ n, results });
    } catch (error) {
        res.status(500).json({ message: 'ทดสอบ insert ไม่สำเร็จ', error: error.message, results });
    }
});

module.exports = router;
