// ==========================================================
// 📦 models.js — Schema ทั้งหมดของ AERIS + การกำหนด INDEX
// ----------------------------------------------------------
// หลักการเลือก index (จาก Indexing Lab):
//   1) ทำ index เฉพาะ field ที่ถูก "ค้นหา / กรอง / เรียงลำดับ" บ่อยจริง
//   2) field ที่ค่าหลากหลาย (cardinality สูง) ได้ประโยชน์มากกว่า field ที่มีไม่กี่ค่า
//   3) Composite index ใช้ได้เมื่อ query เริ่มจาก field ซ้ายสุด (Leftmost rule)
//   4) ทุก index ทำให้ INSERT/UPDATE ช้าลงและกินพื้นที่ → ไม่ทำทุก column
// ทุก index ตั้งชื่อเอง { name: 'idx_...' } เพื่อให้เห็นชัดใน explain() และหน้า Indexing
// ==========================================================
const mongoose = require('mongoose');

// ----------------------------------------------------------
// 1) USER — ลูกค้า / ผู้ดูแลระบบ (หน้า Login / Register)
// ----------------------------------------------------------
const userSchema = new mongoose.Schema({
    name:     { type: String, trim: true },                 // ชื่อ-นามสกุล จากฟอร์มลงทะเบียน
    username: { type: String, required: true, trim: true }, // ลูกค้า = อีเมล, แอดมิน = รหัสพนักงาน
    email:    { type: String, trim: true, lowercase: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

// 🔑 INDEX: login / register ค้นด้วย username ทุกครั้ง + บังคับห้ามซ้ำ
userSchema.index({ username: 1 }, { unique: true, name: 'idx_user_username_unique' });
// 🔑 INDEX: login ใช้ $or: [{ email }, { username }] → ต้องมี index ทั้ง 2 field
//    ถ้าขาดตัวใดตัวหนึ่ง MongoDB จะต้อง COLLSCAN ทั้ง collection
userSchema.index({ email: 1 }, { sparse: true, name: 'idx_user_email' });

// ----------------------------------------------------------
// 2) PRODUCT — สินค้าแอร์ 13 รุ่น (เดิมอยู่ใน productsData ของหน้าเว็บ)
// ----------------------------------------------------------
const productSchema = new mongoose.Schema({
    pid:       { type: Number, required: true },   // = id เดิมในหน้าเว็บ (1–13)
    name:      { type: String, required: true },
    series:    { type: String },
    type:      { type: String, required: true },   // แอร์ติดผนัง / แอร์ฝังฝ้าเชิงพาณิชย์
    imgType:   { type: String, enum: ['wall', 'ceiling'], default: 'wall' },
    btuNum:    { type: Number, required: true },
    price:     { type: Number, required: true },
    room:      { type: String },
    features:  [String],
    badge:     { type: String },
    sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

// 🔑 INDEX: ดึงสินค้า 1 ชิ้นด้วย pid
productSchema.index({ pid: 1 }, { unique: true, name: 'idx_product_pid_unique' });
// 🔑 INDEX: ปุ่มกรอง "แอร์ติดผนัง / แอร์ฝังฝ้า" → filter type แล้ว sort ตาม sortOrder
productSchema.index({ type: 1, sortOrder: 1 }, { name: 'idx_product_type_sort' });
// 🔑 INDEX: Simulator แนะนำรุ่น → imgType (=) + btuNum (=/range) แล้ว sort ราคา
productSchema.index({ imgType: 1, btuNum: 1, price: 1 }, { name: 'idx_product_img_btu_price' });
// หมายเหตุ: สินค้ามีแค่ 13 รุ่น ไม่มี index ก็เร็ว — ทำไว้ให้พร้อมเมื่อสินค้าเพิ่ม
// ส่วนที่เห็นผลต่างชัดเจนคือ collection "orders" ด้านล่าง

// ----------------------------------------------------------
// 3) BOOKING — ฟอร์ม "นัดหมายบริการ" (หน้าบริการ)
//    field ชุดเดิม (name, phone, service, details, status) ยังเหมือนเดิม — ข้อมูลเก่าใช้ต่อได้
// ----------------------------------------------------------
const bookingSchema = new mongoose.Schema({
    name:          { type: String, required: true, trim: true },
    phone:         { type: String, required: true, trim: true },
    service:       { type: String, required: true },
    details:       { type: String, maxlength: 2000 },
    email:         { type: String, trim: true, lowercase: true }, // [ใหม่] ไม่บังคับ — ใช้ส่งอีเมลยืนยัน
    preferredDate: { type: Date },                                 // [ใหม่] ไม่บังคับ — วันที่สะดวก
    status:        { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], default: 'Pending' },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// 🔑 INDEX: แอดมินดูงาน "รอยืนยัน" ล่าสุดก่อน → status (=) + sort createdAt
bookingSchema.index({ status: 1, createdAt: -1 }, { name: 'idx_booking_status_created' });
// 🔑 INDEX: ลูกค้าโทรมาถามสถานะ → ค้นจากเบอร์โทร
bookingSchema.index({ phone: 1, createdAt: -1 }, { name: 'idx_booking_phone_created' });
// 🔑 PARTIAL INDEX: "นัดหมายของฉัน" — เก็บเฉพาะ booking ที่ผูกกับ user (ล็อกอินแล้ว) index จึงเล็กลง
bookingSchema.index({ userId: 1, createdAt: -1 }, {
    name: 'idx_booking_user_created',
    partialFilterExpression: { userId: { $exists: true } }
});

// ----------------------------------------------------------
// 4) SIMULATION — log การจำลองห้อง 3D / คำนวณ BTU
// ----------------------------------------------------------
const simulationSchema = new mongoose.Schema({
    width: Number, length: Number, height: Number,
    sunFactor: Number, people: Number,
    area: Number, rawBtu: Number, targetBTU: Number
}, { timestamps: true });

// 🔑 TTL INDEX: ลบ log อัตโนมัติเมื่ออายุเกิน 90 วัน (MongoDB ลบให้เอง)
simulationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90, name: 'idx_sim_ttl_90d' });
// 🔑 INDEX: สถิติ "ลูกค้าส่วนใหญ่ต้องใช้แอร์กี่ BTU"
simulationSchema.index({ targetBTU: 1 }, { name: 'idx_sim_target_btu' });

// ----------------------------------------------------------
// 5) ORDER — ประวัติการสั่งซื้อ (ข้อมูลจำลองจำนวนมาก สำหรับทดสอบ index)
//    เทียบได้กับตาราง transactions ใน Lab PostgreSQL
// ----------------------------------------------------------
const orderSchema = new mongoose.Schema({
    orderNo:    { type: String },                 // ≈ description  ('ord-123')
    orderDate:  { type: Date, required: true },   // ≈ transaction_date
    customerId: { type: Number, required: true }, // ≈ customer_id (1–10,000)
    productPid: { type: Number },
    btuNum:     { type: Number },
    amount:     { type: Number, required: true }, // ≈ amount
    status:     { type: String, enum: ['paid', 'pending', 'cancelled'], required: true }, // ≈ status
    province:   { type: String }
}, { versionKey: false });

// 🔑 COMPOSITE INDEX: "ประวัติการซื้อ" → WHERE customerId = ? ORDER BY orderDate DESC LIMIT n
//    ใช้กับ query ที่ค้นด้วย customerId อย่างเดียวได้ด้วย (Leftmost rule) จึงไม่ต้องมี index customerId แยก
orderSchema.index({ customerId: 1, orderDate: -1 }, { name: 'idx_order_cust_date' });
// 🔑 INDEX: รายงานยอดขายรายวัน / ช่วงวันที่
orderSchema.index({ orderDate: 1 }, { name: 'idx_order_date' });
// 🔑 COMPOSITE INDEX: รายการค้างชำระ status = 'pending' AND orderDate >= ? (โจทย์ Workshop ข้อ 1)
//    status (เท่ากับ) อยู่หน้า orderDate (ช่วง) ตามกฎ ESR: Equality → Sort → Range
orderSchema.index({ status: 1, orderDate: 1 }, { name: 'idx_order_status_date' });
// ❌ ตั้งใจไม่ทำ index: amount, province, orderNo — ไม่ค่อยถูกค้น และทำแล้ว INSERT ช้าลง (Lab 07)

module.exports = {
    User:       mongoose.model('User', userSchema),
    Product:    mongoose.model('Product', productSchema),
    Booking:    mongoose.model('Booking', bookingSchema),
    Simulation: mongoose.model('Simulation', simulationSchema),
    Order:      mongoose.model('Order', orderSchema)
};
