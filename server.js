// ==========================================================
// 🚀 server.js — AERIS / HVACR REST API (Express + MongoDB)
//   • Frontend (GitHub Pages / index.html) เรียก API ที่ /api/...
//   • รันบนเครื่อง (docker compose) เปิดหน้าเว็บได้ที่ http://localhost:3000
// ==========================================================
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { User, Product, Booking, Simulation, Order } = require('./models');
const { seedCore, seedIndexLab } = require('./seed');
const indexLabRouter = require('./indexLab');

// ปิด autoIndex → ให้ seed.js สร้าง index "หลัง" ใส่ข้อมูลเสร็จ (เร็วกว่า และควบคุมลำดับได้)
mongoose.set('autoIndex', false);

const app = express();

// ==========================================
// 🚨 CORS (อนุญาตให้ GitHub Pages / Live Server / เปิดไฟล์ตรง ๆ คุยกับ Backend ได้)
//    เพิ่ม origin อื่นได้ทาง ENV: CORS_ORIGINS="https://a.com,https://b.com"
// ==========================================
const allowedOrigins = [
    'https://67160235.github.io',
    'http://127.0.0.1:5500', 'http://localhost:5500',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'null', // ดับเบิลคลิกเปิด index.html จากเครื่อง (file://) เบราว์เซอร์จะส่ง Origin: null
    ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
];
// ระบบใช้ Bearer Token (ไม่ใช้ cookie) จึงไม่ต้องเปิด credentials
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

// ⚠️ ห้ามใส่รหัส/URL ฐานข้อมูลไว้ในโค้ด — ตั้งค่าใน ENV (Render → Environment / docker-compose.yml)
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hvacr_db';
const PORT = process.env.PORT || 3000;
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbwm_FHTnWG2RneIPXksg9y2nibB0e-YeES2b1IVKY0jslmLMXLEZjhbHSCURhSRc-Q/exec';

// สถานะระบบ — server เปิด port ทันที แล้วค่อยต่อ DB / seed เบื้องหลัง (Render จะได้ไม่ timeout)
//   coreReady : Login / สินค้า / นัดหมาย ใช้งานได้ (ใช้เวลาไม่กี่วินาที)
//   labReady  : ข้อมูล orders + index ของหน้า Indexing พร้อม (ครั้งแรกอาจใช้ 30-60 วินาที)
const state = { coreReady: false, labReady: false, seeding: false, error: null };

// ==========================================
// 🧰 Helpers
// ==========================================
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const signToken = (u) => jwt.sign({ id: u._id, username: u.username, email: u.email, name: u.name, role: u.role }, JWT_SECRET, { expiresIn: '1d' });
const publicUser = (u) => ({ id: u._id, name: u.name, username: u.username, email: u.email, role: u.role });

// สูตร BTU เดียวกับหน้าเว็บ: พื้นที่ × ค่าแดด + คนที่เกิน 2 คน คนละ 500 → ปัดขึ้นเป็นขนาดมาตรฐาน
const STANDARD_BTU = [9000, 12000, 15000, 18000, 24000, 30000, 36000, 48000];
function calculateBTU({ width, length, height, sunFactor, people }) {
    const clamp = (v, min, max, def) => Math.min(Math.max(Number.isFinite(+v) ? +v : def, min), max);
    const w = clamp(width, 2, 8, 3.5), l = clamp(length, 2, 12, 4), h = clamp(height, 2.4, 4, 2.6);
    const sun = [700, 800, 900].includes(Number(sunFactor)) ? Number(sunFactor) : 800;
    const p = Math.round(clamp(people, 1, 20, 2));
    const area = w * l;
    const rawBtu = area * sun + (p > 2 ? (p - 2) * 500 : 0);
    const targetBTU = STANDARD_BTU.find(s => rawBtu <= s) || 48000;
    return { width: w, length: l, height: h, sunFactor: sun, people: p, area: +area.toFixed(2), volume: +(area * h).toFixed(2), rawBtu: Math.round(rawBtu), targetBTU };
}

// แนะนำรุ่น — ตรรกะเดียวกับ renderSimProducts() ในหน้าเว็บ (ใช้ idx_product_img_btu_price)
async function recommendProducts(targetBTU) {
    let matched = await Product.find({ imgType: 'wall', btuNum: targetBTU }).sort({ sortOrder: 1 }).limit(3).lean();
    if (matched.length === 0) {
        matched = await Product.find({ btuNum: { $gte: targetBTU } }).sort({ sortOrder: 1 }).limit(3).lean();
    }
    return matched;
}

// ==========================================
// 🛡️ Middleware
// ==========================================
const authenticateToken = (req, res, next) => {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ message: 'ปฏิเสธการเข้าถึง: กรุณาเข้าสู่ระบบ' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'ปฏิเสธการเข้าถึง: Token ไม่ถูกต้องหรือหมดอายุ' });
        req.user = user;
        next();
    });
};

// ไม่บังคับล็อกอิน แต่ถ้าส่ง token มาก็อ่านข้อมูลผู้ใช้ไว้ (ใช้กับฟอร์มนัดหมาย / simulator)
const optionalAuth = (req, res, next) => {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return next();
    jwt.verify(token, JWT_SECRET, (err, user) => { if (!err) req.user = user; next(); });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
    next();
};

// ยังต่อ DB ไม่ได้ → ตอบ 503 ทันที (ไม่ปล่อยให้หน้าเว็บค้าง)
const requireReady = (req, res, next) => {
    if (!state.coreReady) return res.status(503).json({ message: 'เซิร์ฟเวอร์กำลังเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง', error: state.error });
    next();
};
const requireLabReady = (req, res, next) => {
    if (!state.labReady) return res.status(503).json({ message: 'กำลังเตรียมข้อมูล orders สำหรับทดสอบ index (ครั้งแรกใช้เวลา 30-60 วินาที) กรุณารอสักครู่' });
    next();
};

// ==========================================
// 📚 API Router
// ==========================================
const api = express.Router();

api.get('/health', (req, res) => {
    res.json({
        status: 'ok', version: 2,
        ready: state.coreReady, labReady: state.labReady, seeding: state.seeding,
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date()
    });
});

api.use(requireReady); // ทุก endpoint ด้านล่างต้องรอ DB พร้อมก่อน

// ------------------------------------------
// หมวด 1: Authentication (หน้า Login / Register)
// ------------------------------------------
// POST /api/auth/register { name, email, password } — ใช้อีเมลเป็น username
api.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        if (String(password).length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
        const username = String(email).trim().toLowerCase();

        const existingUser = await User.exists({ username }); // idx_user_username_unique
        if (existingUser) return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });

        await User.create({ name, username, email: username, password: await bcrypt.hash(password, 10) });
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ' });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก', error: error.message });
    }
});

// POST /api/auth/login { email, password } — รับได้ทั้งอีเมลหรือ username
api.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const id = String(email || '').trim();
        // $or ใช้ index 2 ตัว: idx_user_email + idx_user_username_unique
        const user = await User.findOne({ $or: [{ email: id.toLowerCase() }, { username: id }, { username: id.toLowerCase() }] });
        if (!user) return res.status(404).json({ message: 'ไม่พบอีเมลหรือผู้ใช้งานนี้ในระบบ' });

        const ok = await bcrypt.compare(password || '', user.password);
        if (!ok) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ', token: signToken(user), user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error.message });
    }
});

// POST /api/auth/admin-login { username, password } — แทนการเช็กรหัสแอดมินในหน้าเว็บ
api.post('/auth/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: String(username || '').trim() });
        const ok = user && user.role === 'admin' && await bcrypt.compare(password || '', user.password);
        if (!ok) return res.status(401).json({ message: 'ชื่อผู้ใช้งานหรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง' });
        res.json({ message: 'เข้าสู่ระบบแอดมินสำเร็จ', token: signToken(user), user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error.message });
    }
});

api.post('/auth/logout', (req, res) => {
    res.json({ message: 'ออกจากระบบสำเร็จ (ลบ Token ที่ฝั่งหน้าเว็บแล้ว)' });
});

api.get('/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password').lean();
        if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลส่วนตัว' });
    }
});

api.post('/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
        const user = await User.findById(req.user.id);
        if (!user || !(await bcrypt.compare(oldPassword || '', user.password))) return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน', error: error.message });
    }
});

// ------------------------------------------
// หมวด 2: สินค้า (หน้า "สินค้า" + การ์ดแนะนำใน Simulator)
// ------------------------------------------
// GET /api/products?type=แอร์ติดผนัง
api.get('/products', async (req, res) => {
    try {
        const filter = {};
        if (req.query.type && req.query.type !== 'ทั้งหมด') filter.type = req.query.type; // idx_product_type_sort
        const products = await Product.find(filter).sort({ sortOrder: 1 }).lean();
        res.set('Cache-Control', 'public, max-age=300'); // ให้เบราว์เซอร์ cache 5 นาที เปิดหน้าซ้ำจะเร็วขึ้น
        res.json({ data: products, total: products.length });
    } catch (error) {
        res.status(500).json({ message: 'ดึงข้อมูลสินค้าไม่สำเร็จ', error: error.message });
    }
});

// GET /api/products/recommend?btu=12000
api.get('/products/recommend', async (req, res) => {
    try {
        const btu = parseInt(req.query.btu, 10);
        if (!btu) return res.status(400).json({ message: 'กรุณาระบุ btu' });
        res.json({ targetBTU: btu, data: await recommendProducts(btu) });
    } catch (error) {
        res.status(500).json({ message: 'แนะนำสินค้าไม่สำเร็จ', error: error.message });
    }
});

api.get('/products/:pid', async (req, res) => {
    try {
        const product = await Product.findOne({ pid: Number(req.params.pid) }).lean(); // idx_product_pid_unique
        if (!product) return res.status(404).json({ message: 'ไม่พบสินค้านี้' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'ดึงข้อมูลสินค้าไม่สำเร็จ', error: error.message });
    }
});

// ------------------------------------------
// หมวด 3: จำลองห้อง 3D / คำนวณ BTU
// ------------------------------------------
// POST /api/simulations { width, length, height, sunFactor, people }
// → คำนวณซ้ำฝั่ง server + บันทึก log + ส่งรุ่นที่แนะนำกลับไป
api.post('/simulations', async (req, res) => {
    try {
        const calc = calculateBTU(req.body);
        await Simulation.create({
            width: calc.width, length: calc.length, height: calc.height,
            sunFactor: calc.sunFactor, people: calc.people,
            area: calc.area, rawBtu: calc.rawBtu, targetBTU: calc.targetBTU
        });
        res.status(201).json({ ...calc, recommendations: await recommendProducts(calc.targetBTU) });
    } catch (error) {
        res.status(500).json({ message: 'คำนวณ BTU ไม่สำเร็จ', error: error.message });
    }
});

// GET /api/simulations/stats — ลูกค้าจำลองห้องที่ต้องใช้กี่ BTU มากที่สุด (idx_sim_target_btu)
api.get('/simulations/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await Simulation.aggregate([{ $group: { _id: '$targetBTU', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
        res.json(stats.map(s => ({ targetBTU: s._id, count: s.count })));
    } catch (error) {
        res.status(500).json({ message: 'ดึงสถิติไม่สำเร็จ', error: error.message });
    }
});

// ------------------------------------------
// หมวด 4: นัดหมายบริการ + อีเมลยืนยัน (Google Apps Script)
// ------------------------------------------
async function sendBookingEmail({ to, subject, message, bookingDetails }) {
    const d = bookingDetails || {};
    const htmlContent = `
        <div style="font-family: 'Sarabun', sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px; margin: auto;">
            <h2 style="color: #006A9C; border-bottom: 2px solid #006A9C; padding-bottom: 10px;">📌 ยืนยันการจองบริการ AERIS</h2>
            <p style="font-size: 16px; color: #2d3748;">${escapeHtml(message || 'ขอบคุณที่ใช้บริการระบบของเรา รายละเอียดการจองของคุณมีดังนี้ครับ:')}</p>
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>ชื่อ:</strong> ${escapeHtml(d.name || '-')}</p>
                <p style="margin: 5px 0;"><strong>บริการ:</strong> ${escapeHtml(d.service || '-')}</p>
                <p style="margin: 5px 0;"><strong>วันที่สะดวก:</strong> ${escapeHtml(d.date || '-')}</p>
                <p style="margin: 5px 0;"><strong>รายละเอียด:</strong> ${escapeHtml(d.details || '-')}</p>
            </div>
            <p style="margin-top: 20px; color: #718096; font-size: 14px;">หากมีข้อสงสัยหรือต้องการเปลี่ยนแปลงข้อมูลการจอง สามารถติดต่อทีมงานได้ทันที</p>
        </div>`;
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: subject || 'ยืนยันการจองบริการ AERIS สำเร็จ', html: htmlContent })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Google Apps Script ปฏิเสธการส่ง');
}

// POST /api/bookings { name, phone, service, details, email?, preferredDate? } — ฟอร์มหน้า "บริการ"
api.post('/bookings', optionalAuth, async (req, res) => {
    try {
        const { name, phone, service, details, email, preferredDate } = req.body;
        if (!name || !phone || !service) return res.status(400).json({ message: 'กรุณากรอกชื่อ เบอร์โทร และบริการที่ต้องการ' });

        const booking = await Booking.create({
            name, phone, service, details,
            email: email || req.user?.email || undefined,
            preferredDate: preferredDate ? new Date(`${preferredDate}T00:00:00.000Z`) : undefined,
            userId: req.user?.id
        });

        // ส่งอีเมลยืนยัน (ถ้ามีอีเมล) — ส่งไม่สำเร็จก็ยังบันทึกการจองไว้
        let emailSent = false;
        if (booking.email) {
            try {
                await sendBookingEmail({ to: booking.email, bookingDetails: { name, service, details, date: preferredDate } });
                emailSent = true;
            } catch (e) { console.warn('⚠️ ส่งอีเมลไม่สำเร็จ:', e.message); }
        }
        res.status(201).json({ message: 'บันทึกการนัดหมายสำเร็จ', emailSent, id: booking._id });
    } catch (error) {
        res.status(400).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', error: error.message });
    }
});

// GET /api/bookings — admin: ?status=Pending&phone=08...  |  ลูกค้า: เห็นเฉพาะของตัวเอง
api.get('/bookings', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            const filter = {};
            if (req.query.status) filter.status = req.query.status; // idx_booking_status_created
            if (req.query.phone) filter.phone = req.query.phone;    // idx_booking_phone_created
            return res.json(await Booking.find(filter).sort({ createdAt: -1 }).limit(200).lean());
        }
        res.json(await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean()); // idx_booking_user_created
    } catch (error) {
        res.status(500).json({ message: 'ดึงข้อมูลนัดหมายไม่สำเร็จ', error: error.message });
    }
});

// PATCH /api/bookings/:id/status { status } — แอดมินเปลี่ยนสถานะงาน
api.patch('/bookings/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'ID ไม่ถูกต้อง' });
        const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
        if (!booking) return res.status(404).json({ message: 'ไม่พบการนัดหมายนี้' });
        res.json({ message: 'อัปเดตสถานะสำเร็จ', data: booking });
    } catch (error) {
        res.status(400).json({ message: 'อัปเดตสถานะไม่สำเร็จ', error: error.message });
    }
});

// endpoint เดิม — ส่งอีเมลยืนยันให้ผู้ใช้ที่ล็อกอินแล้ว (เรียกได้ทั้ง /api/send-booking-email และ /send-booking-email)
async function sendBookingEmailHandler(req, res) {
    try {
        const { to, subject, message, bookingDetails } = req.body;
        const recipientEmail = to || req.user.email;
        if (!recipientEmail) return res.status(400).json({ message: 'ไม่พบอีเมลผู้รับ กรุณาระบุอีเมลในคำขอหรือตั้งค่าอีเมลในระบบ' });
        await sendBookingEmail({ to: recipientEmail, subject, message, bookingDetails });
        res.json({ message: 'ส่งอีเมลยืนยันการจองสำเร็จผ่านระบบ Google Cloud' });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งข้อมูลไปหา Google', error: error.message });
    }
}
api.post('/send-booking-email', authenticateToken, sendBookingEmailHandler);

// ------------------------------------------
// หมวด 5: ประวัติการซื้อ (composite index idx_order_cust_date)
// ------------------------------------------
api.get('/orders/history/:customerId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customerId = parseInt(req.params.customerId, 10);
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const t0 = Date.now();
        const orders = await Order.find({ customerId }).sort({ orderDate: -1 }).limit(limit).lean();
        res.json({ customerId, tookMs: Date.now() - t0, data: orders });
    } catch (error) {
        res.status(500).json({ message: 'ดึงประวัติการซื้อไม่สำเร็จ', error: error.message });
    }
});

// ------------------------------------------
// หมวด 6: Indexing Lab (หน้า "Indexing" — เฉพาะแอดมิน)
// ------------------------------------------
api.use('/index-lab', authenticateToken, requireAdmin, requireLabReady, indexLabRouter);

app.use('/api', api);
app.post('/send-booking-email', requireReady, authenticateToken, sendBookingEmailHandler); // path เดิม

// ==========================================
// 🌐 เสิร์ฟหน้าเว็บ index.html (เฉพาะไฟล์นี้ — ไม่เปิดให้ดาวน์โหลด server.js / .env)
// ==========================================
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use((req, res) => res.status(404).json({ message: `ไม่พบ endpoint ${req.method} ${req.path}` }));

// ==========================================
// 🔌 Start: เปิด port ก่อน → ต่อ DB → seed + สร้าง index เบื้องหลัง
// ==========================================
async function connectAndSeed(retries = 10) {
    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ Connected to MongoDB Database Successfully');
        state.seeding = true;
        await seedCore();              // สินค้า + index ของ users/products/bookings + แอดมิน
        state.coreReady = true;
        state.error = null;
        console.log('✅ ระบบพร้อมใช้งาน (Login / สินค้า / นัดหมาย)');
        await seedIndexLab();          // orders จำนวนมาก + index ของ orders (ทำเบื้องหลัง)
        state.labReady = true;
        state.seeding = false;
        console.log('✅ หน้า Indexing พร้อมใช้งาน');
    } catch (err) {
        state.seeding = false;
        state.error = err.message;
        console.error('❌ Database error:', err.message);
        if (retries > 0 && !state.coreReady) {
            console.log(`⏳ ลองใหม่ใน 5 วินาที (เหลือ ${retries} ครั้ง)`);
            await mongoose.disconnect().catch(() => {});
            setTimeout(() => connectAndSeed(retries - 1), 5000);
        }
    }
}

if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 API Server running on port ${PORT}`));
    connectAndSeed();
}

module.exports = { app, calculateBTU };
