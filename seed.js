// ==========================================================
// 🌱 seed.js — ข้อมูลเริ่มต้น + สร้าง INDEX
//   1) สินค้า 13 รุ่น (ชุดเดียวกับ productsData ในหน้าเว็บ)
//   2) บัญชีผู้ดูแลระบบ (จาก ENV: ADMIN_ACCOUNTS) — ไม่เก็บรหัสในหน้าเว็บอีกต่อไป
//   3) orders จำลองจำนวนมาก (สำหรับหน้า Indexing)
//   4) สร้าง index "หลัง" ใส่ข้อมูล (เหมือน 03-create-index.sql)
// รันอัตโนมัติตอน server start หรือรันเอง:  npm run seed   |   seed orders ใหม่ทั้งหมด: npm run seed:reset
// ==========================================================
const bcrypt = require('bcryptjs');
const { User, Product, Booking, Simulation, Order } = require('./models');

const PRODUCTS = [
    { pid: 1,  name: 'AERIS Zen Inverter 9,000 BTU',  series: 'Zen Inverter', type: 'แอร์ติดผนัง', btuNum: 9000,  price: 12990, room: '10–12', features: ['ประหยัดไฟเบอร์ 5', 'เงียบพิเศษ 19 dB', 'สารทำความเย็น R32'], badge: 'ขายดี', imgType: 'wall' },
    { pid: 2,  name: 'AERIS Zen Inverter 12,000 BTU', series: 'Zen Inverter', type: 'แอร์ติดผนัง', btuNum: 12000, price: 14490, room: '13–16', features: ['ประหยัดไฟเบอร์ 5', 'เงียบพิเศษ 19 dB', 'สารทำความเย็น R32'], imgType: 'wall' },
    { pid: 3,  name: 'AERIS Zen Inverter 18,000 BTU', series: 'Zen Inverter', type: 'แอร์ติดผนัง', btuNum: 18000, price: 18990, room: '20–24', features: ['ประหยัดไฟเบอร์ 5', 'แผ่นกรองฝุ่นละเอียด', 'สารทำความเย็น R32'], imgType: 'wall' },
    { pid: 13, name: 'AERIS Zen Inverter 24,000 BTU', series: 'Zen Inverter', type: 'แอร์ติดผนัง', btuNum: 24000, price: 24490, room: '27–32', features: ['ประหยัดไฟเบอร์ 5', 'ทำความเย็นเร็ว Turbo', 'สารทำความเย็น R32'], imgType: 'wall' },
    { pid: 4,  name: 'AERIS Pure Air 24,000 BTU',     series: 'Pure Air', type: 'แอร์ติดผนัง', btuNum: 24000, price: 26990, room: '27–32', features: ['ฟอกอากาศ PM2.5 ในตัว', 'ควบคุมผ่าน Wi-Fi'], imgType: 'wall' },
    { pid: 5,  name: 'AERIS Breeze 9,000 BTU',        series: 'Breeze', type: 'แอร์ติดผนัง', btuNum: 9000,  price: 9990,  room: '10–12', features: ['คุ้มค่า ประหยัด', 'ทำความเย็นเร็ว', 'สารทำความเย็น R32'], badge: 'ประหยัด', imgType: 'wall' },
    { pid: 6,  name: 'AERIS Breeze 12,000 BTU',       series: 'Breeze', type: 'แอร์ติดผนัง', btuNum: 12000, price: 11490, room: '13–16', features: ['คุ้มค่า ประหยัด', 'ทำความเย็นเร็ว'], imgType: 'wall' },
    { pid: 7,  name: 'AERIS Pure Air 12,000 BTU',     series: 'Pure Air', type: 'แอร์ติดผนัง', btuNum: 12000, price: 16990, room: '13–16', features: ['ฟอกอากาศ PM2.5 ในตัว', 'ควบคุมผ่าน Wi-Fi'], badge: 'ฟอกอากาศ', imgType: 'wall' },
    { pid: 8,  name: 'AERIS Pure Air 18,000 BTU',     series: 'Pure Air', type: 'แอร์ติดผนัง', btuNum: 18000, price: 21490, room: '20–24', features: ['ฟอกอากาศ PM2.5 ในตัว', 'ควบคุมผ่าน Wi-Fi', 'ประหยัดไฟเบอร์ 5'], imgType: 'wall' },
    { pid: 9,  name: 'AERIS Breeze 18,000 BTU',       series: 'Breeze', type: 'แอร์ติดผนัง', btuNum: 18000, price: 15490, room: '20–24', features: ['คุ้มค่า ประหยัด', 'ทำความเย็นเร็ว', 'สารทำความเย็น R32'], imgType: 'wall' },
    { pid: 10, name: 'AERIS Sky Pro 24,000 BTU',      series: 'Sky Pro', type: 'แอร์ฝังฝ้าเชิงพาณิชย์', btuNum: 24000, price: 33490, room: '27–32', features: ['แขวนลอย/ฝังฝ้า 4 ทิศทาง', 'เหมาะกับร้านค้า สำนักงาน'], imgType: 'ceiling' },
    { pid: 11, name: 'AERIS Sky Pro 36,000 BTU',      series: 'Sky Pro', type: 'แอร์ฝังฝ้าเชิงพาณิชย์', btuNum: 36000, price: 39990, room: '40–48', features: ['แขวนลอย/ฝังฝ้า 4 ทิศทาง', 'เหมาะกับร้านค้า สำนักงาน'], imgType: 'ceiling' },
    { pid: 12, name: 'AERIS Sky Pro 48,000 BTU',      series: 'Sky Pro', type: 'แอร์ฝังฝ้าเชิงพาณิชย์', btuNum: 48000, price: 46490, room: '53–64', features: ['แขวนลอย/ฝังฝ้า 4 ทิศทาง', 'เหมาะกับพื้นที่เชิงพาณิชย์'], badge: 'เชิงพาณิชย์', imgType: 'ceiling' }
].map((p, i) => ({ ...p, sortOrder: i + 1 }));

const PROVINCES = ['กรุงเทพฯ', 'นนทบุรี', 'ปทุมธานี', 'ชลบุรี', 'เชียงใหม่', 'ขอนแก่น', 'ภูเก็ต', 'นครราชสีมา', 'สงขลา', 'ระยอง'];

// random แบบกำหนด seed (เหมือน setseed(0.42) ใน Lab) → seed ใหม่กี่ครั้งข้อมูลก็เหมือนเดิม
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function seedProducts() {
    // upsert ทีละรุ่น — แก้ราคาใน PRODUCTS แล้ว restart server ก็อัปเดตตาม
    await Product.bulkWrite(PRODUCTS.map(p => ({
        updateOne: { filter: { pid: p.pid }, update: { $set: { ...p, badge: p.badge || null } }, upsert: true }
    })));
    console.log(`🌱 Products: ${PRODUCTS.length} รุ่น`);
}

// ADMIN_ACCOUNTS="รหัสพนักงาน:รหัสผ่าน,รหัสพนักงาน:รหัสผ่าน"
// สร้างเฉพาะบัญชีที่ยังไม่มี (ถ้ามีแล้วจะไม่ทับรหัสผ่านเดิม)
async function seedAdmins() {
    const raw = process.env.ADMIN_ACCOUNTS || '';
    const accounts = raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        const i = s.indexOf(':');
        return { username: s.slice(0, i).trim(), password: s.slice(i + 1) };
    }).filter(a => a.username && a.password);

    if (accounts.length === 0) {
        console.warn('⚠️ ยังไม่ได้ตั้ง ADMIN_ACCOUNTS — จะยังไม่มีบัญชีผู้ดูแลระบบ');
        return;
    }
    for (const a of accounts) {
        const exists = await User.findOne({ username: a.username });
        if (!exists) {
            await User.create({ username: a.username, name: `Admin ${a.username}`, password: await bcrypt.hash(a.password, 10), role: 'admin' });
            console.log(`🌱 Admin: ${a.username}`);
        } else if (exists.role !== 'admin') {
            await User.updateOne({ _id: exists._id }, { role: 'admin' });
        }
    }
}

// ใส่ orders จำนวนมาก ย้อนหลัง 365 วันจาก 2026-09-25 (โครงเดียวกับ 02-seed.sql)
async function seedOrders(force = false) {
    const target = parseInt(process.env.ORDER_SEED_COUNT, 10) || 100000;
    const existing = await Order.estimatedDocumentCount();
    if (existing > 0 && !force) {
        console.log(`🌱 Orders: มีอยู่แล้ว ${existing.toLocaleString()} documents (ข้าม)`);
        return;
    }
    if (force) await Order.collection.drop().catch(() => {});

    console.log(`🌱 Seeding orders ${target.toLocaleString()} documents ...`);
    const rand = mulberry32(42);
    const start = Date.UTC(2025, 8, 25); // 2025-09-25
    const DAY = 86400000;
    const statuses = ['paid', 'paid', 'paid', 'pending', 'cancelled']; // paid ~60% / pending ~20% / cancelled ~20%
    const BATCH = 5000;
    const t0 = Date.now();

    for (let offset = 0; offset < target; offset += BATCH) {
        const docs = [];
        for (let i = offset; i < Math.min(offset + BATCH, target); i++) {
            const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
            docs.push({
                orderNo: `ord-${i + 1}`,
                orderDate: new Date(start + Math.round(rand() * 365) * DAY),
                customerId: Math.floor(rand() * 10000) + 1,
                productPid: product.pid,
                btuNum: product.btuNum,
                amount: product.price,
                status: statuses[Math.floor(rand() * statuses.length)],
                province: PROVINCES[Math.floor(rand() * PROVINCES.length)]
            });
        }
        await Order.collection.insertMany(docs, { ordered: false }); // ใช้ driver ตรงเพื่อความเร็ว
    }
    console.log(`🌱 Seed orders done (${((Date.now() - t0) / 1000).toFixed(1)} วินาที)`);
}

// สร้าง index ตามที่ประกาศใน models.js
// syncIndexes() = สร้าง index ที่ยังไม่มี + ลบ index ที่ไม่ได้ประกาศแล้ว
async function buildIndexes(models = [User, Product, Booking, Simulation, Order]) {
    const t0 = Date.now();
    for (const Model of models) await Model.syncIndexes();
    console.log(`🔑 Indexes ready: ${models.map(m => m.collection.collectionName).join(', ')} (${((Date.now() - t0) / 1000).toFixed(1)} วินาที)`);
}

// ส่วนที่หน้าเว็บต้องใช้ทันที (Login / สินค้า / นัดหมาย) — เสร็จในไม่กี่วินาที
async function seedCore() {
    await seedProducts();
    await buildIndexes([User, Product, Booking, Simulation]); // unique index ของ users ต้องมีก่อนสร้างแอดมิน
    await seedAdmins();
}

// ส่วนของหน้า Indexing (ใส่ orders จำนวนมาก แล้วค่อยสร้าง index) — ทำเบื้องหลัง ไม่ทำให้ Login ต้องรอ
async function seedIndexLab({ forceOrders = false } = {}) {
    await seedOrders(forceOrders);
    await buildIndexes([Order]);
}

async function seedAll(opts = {}) {
    await seedCore();
    await seedIndexLab(opts);
}

module.exports = { seedAll, seedCore, seedIndexLab, buildIndexes, PRODUCTS };

// รันตรงจาก command line: node seed.js [--reset]
if (require.main === module) {
    const mongoose = require('mongoose');
    mongoose.set('autoIndex', false);
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hvacr_db';
    mongoose.connect(MONGO_URI)
        .then(() => seedAll({ forceOrders: process.argv.includes('--reset') }))
        .then(() => mongoose.disconnect())
        .catch(err => { console.error('❌ Seed error:', err); process.exit(1); });
}
