# ❄️ AERIS — ระบบคำนวณ BTU และจองบริการเครื่องปรับอากาศ 3D

AERIS เป็นแพลตฟอร์ม E-Commerce และบริการเครื่องปรับอากาศ (HVACR) มีระบบจำลองห้อง 3D (Three.js) ช่วยลูกค้าหาขนาด BTU ที่เหมาะสมแบบเรียลไทม์ และมี Backend (Node.js + Express + MongoDB) ดูแลการยืนยันตัวตน สินค้า การนัดหมายบริการ และระบบ **Database Indexing** สำหรับเทียบประสิทธิภาพการค้นหาข้อมูล

🌐 **หน้าเว็บ:** https://67160235.github.io/air.com/
🔌 **Backend API:** https://hvacr-backend-vkua.onrender.com/api/health

---

## 🌟 ฟีเจอร์หลัก

- **Authentication**: สมัครสมาชิก / เข้าสู่ระบบด้วยอีเมล เข้ารหัสผ่านด้วย bcrypt และออก JWT Token มีหน้าเข้าสู่ระบบแยกสำหรับผู้ดูแลระบบ โดยตรวจสอบสิทธิ์ที่ Backend
- **3D Room Simulator & BTU Calculator**: ปรับขนาดห้อง ทิศแดด และจำนวนคน โมเดล 3D เปลี่ยนตามทันที ระบบคำนวณ BTU และแนะนำรุ่นแอร์ที่เหมาะสม ผลการคำนวณถูกส่งไปตรวจซ้ำและบันทึกที่ Backend
- **แคตตาล็อกสินค้า**: ดึงข้อมูลแอร์ 13 รุ่นจาก MongoDB กรองตามประเภท (แอร์ติดผนัง / แอร์ฝังฝ้าเชิงพาณิชย์)
- **ระบบนัดหมายบริการ**: บันทึกคำขอติดตั้ง / ล้าง / ซ่อมแอร์ลงฐานข้อมูล
- **อีเมลยืนยันการจอง**: ถ้ากรอกอีเมลในฟอร์ม (หรือล็อกอินอยู่ ระบบจะใช้อีเมลของบัญชีให้อัตโนมัติ) ระบบจะส่งอีเมลยืนยันผ่าน Google Apps Script Webhook ถ้าส่งไม่สำเร็จ การจองก็ยังถูกบันทึกไว้
- **โหมดออฟไลน์**: ถ้าเชื่อมต่อ Backend ไม่ได้ กด "เข้าใช้งานแบบออฟไลน์" ที่หน้าเข้าสู่ระบบ เพื่อดูสินค้าและจำลองห้องได้ตามปกติ คำขอนัดหมายจะเก็บไว้ในเครื่องแล้วส่งเข้าระบบให้อัตโนมัติเมื่อเชื่อมต่อได้ (หน้าเว็บลองเชื่อมต่อใหม่ทุก 30 วินาที) ส่วนการสมัครสมาชิก ล็อกอิน และหน้า Indexing ต้องต่อเซิร์ฟเวอร์
- **🔑 Database Indexing (เฉพาะผู้ดูแลระบบ)**: หน้าเทียบความเร็ว query แบบมี index กับไม่มี index พร้อม query plan, cardinality, ต้นทุน INSERT และสถิติการใช้ index

---

## 🧱 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, Tailwind CSS, JavaScript, Three.js |
| Backend | Node.js 20, Express 4 |
| Security | bcryptjs, JWT (jsonwebtoken), CORS |
| Database | MongoDB 7 + Mongoose 8 |
| Email | Google Apps Script Webhook |
| DevOps | Docker, Docker Compose, GitHub Pages (Frontend), Render.com (Backend), MongoDB Atlas |

**ภาพรวมสถาปัตยกรรม:** หน้าเว็บ (`index.html`) เรียก REST API ที่ `/api/...` ของ Express ซึ่งต่อกับ MongoDB ผ่าน Mongoose และเรียก Google Apps Script Webhook เพื่อส่งอีเมล เมื่อรันด้วย Docker หรือ `npm start` เซิร์ฟเวอร์เดียวกันจะเสิร์ฟหน้าเว็บที่ `/` ด้วย

```
Browser (index.html) ──► Express API (/api/*) ──► MongoDB
                                  └──────────────► Google Apps Script (อีเมล)
```

---

## 📁 โครงสร้างไฟล์

```
├── index.html          # หน้าเว็บทั้งหมด (Login, หน้าแรก, สินค้า, Simulator, บริการ, Indexing)
├── server.js           # Express API — routes ทั้งหมดอยู่ใต้ /api/...
├── models.js           # Mongoose Schema + การประกาศ Index ทุกตัว
├── seed.js             # ข้อมูลเริ่มต้น (สินค้า, แอดมิน, orders จำลอง) + สร้าง index
├── indexLab.js         # API ของหน้า Indexing (explain / cardinality / insert cost)
├── package.json
├── Dockerfile
├── docker-compose.yml  # api + MongoDB + Mongo Express
├── .env.example        # ตัวอย่างการตั้งค่า Environment
├── .dockerignore
└── .gitignore
```

---

## 💻 วิธีใช้งานเว็บไซต์

### 1. เข้าสู่ระบบ
- **ลูกค้าทั่วไป**: ถ้ายังไม่มีบัญชี กด "ลงทะเบียนที่นี่" แล้วกรอกชื่อ อีเมล และรหัสผ่าน (อย่างน้อย 6 ตัวอักษร) จากนั้นเข้าสู่ระบบด้วยอีเมล
- **ผู้ดูแลระบบ**: สลับไปแท็บ "ผู้ดูแลระบบ" แล้วใช้รหัสพนักงานที่ตั้งไว้ใน `ADMIN_ACCOUNTS` (ดูหัวข้อการตั้งค่า)

> ถ้า Backend บน Render แผนฟรีไม่ได้ถูกใช้งานสักพัก ครั้งแรกอาจใช้เวลาตื่นประมาณ 30–60 วินาที ระหว่างรอ หน้าเว็บจะถามว่าจะเข้าโหมดออฟไลน์ไปก่อนหรือรอต่อ

Token ที่ออกให้หมดอายุใน **1 วัน** หลังจากนั้นต้องเข้าสู่ระบบใหม่

### 2. จำลองห้อง 3D
1. ไปที่เมนู **จำลองห้อง 3D**
2. ลาก Slider หรือพิมพ์ตัวเลข เพื่อปรับความกว้าง ความยาว และความสูงเพดาน
3. เลือกปริมาณแดด และเพิ่ม/ลดจำนวนคน
4. ระบบแสดง **BTU ที่เหมาะสม** พร้อมการ์ดรุ่นแอร์ที่แนะนำ และขึ้นข้อความ "✓ บันทึกผลลงระบบแล้ว" เมื่อ Backend ยืนยันผลแล้ว

### 3. นัดหมายบริการ
1. ไปที่เมนู **บริการ**
2. กรอกชื่อ เบอร์โทร และเลือกบริการที่ต้องการ (รายละเอียด อีเมล และวันที่สะดวกจะกรอกหรือไม่ก็ได้)
3. กด "ส่งคำขอนัดหมาย" ข้อมูลจะถูกบันทึกลงฐานข้อมูล ถ้ากรอกอีเมลไว้ หรือล็อกอินอยู่ จะได้อีเมลยืนยัน
4. ถ้าขณะนั้นเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ระบบเก็บคำขอไว้ในเครื่องและส่งให้เองเมื่อเชื่อมต่อได้ (แถบสีเหลืองด้านบนแสดงจำนวนที่รอส่ง)

### 4. Database Indexing (ผู้ดูแลระบบ)
1. เข้าสู่ระบบด้วยแท็บผู้ดูแลระบบ เมนู **🔑 Indexing** จะปรากฏบน Navbar
2. กด **▶ รันทั้งหมด** เพื่อเทียบ query แบบมี index กับไม่มี index ทีละชุด
3. กด **คำนวณ cardinality** และ **▶ ทดสอบ INSERT** เพื่อดูว่าควรทำ index ที่ field ไหน และ index มากเกินไปมีผลอย่างไร

---

## ⚙️ การติดตั้งและรันโปรเจกต์

### วิธีที่ 1: รันผ่าน Docker (แนะนำ)

1. ติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. คัดลอกไฟล์ตั้งค่า แล้วแก้รหัสแอดมินและ `JWT_SECRET` ใน `.env`
   ```bash
   cp .env.example .env
   ```
3. รันระบบ
   ```bash
   docker compose up -d --build
   docker compose logs -f api      # รอจนเห็น "✅ หน้า Indexing พร้อมใช้งาน" แล้วกด Ctrl+C
   ```
4. เปิดใช้งาน

| Service | URL | หมายเหตุ |
|---|---|---|
| หน้าเว็บ + API | http://localhost:3000 | หน้าเว็บเรียก API บนเครื่องอัตโนมัติ |
| MongoDB | localhost:27017 | database: `hvacr_db` |
| Mongo Express | http://localhost:8081 | GUI ดูข้อมูลและ index (user: `admin` / pass: `pass`) |

ครั้งแรกระบบจะ seed ข้อมูล orders จำลอง ใช้เวลาประมาณ 30–60 วินาที จำนวนขึ้นกับ `ORDER_SEED_COUNT` ถ้าไม่ได้สร้างไฟล์ `.env` จะเป็น 200,000 รายการ (ค่าเริ่มต้นของ `docker-compose.yml`) แต่ถ้าคัดลอกจาก `.env.example` ตามขั้นตอนข้างบน จะเป็น 100,000 รายการ

log จะขึ้น 2 ช่วง: `✅ ระบบพร้อมใช้งาน` = Login / สินค้า / นัดหมาย ใช้ได้แล้ว และ `✅ หน้า Indexing พร้อมใช้งาน` = seed orders และสร้าง index เสร็จ ก่อนข้อความที่สอง หน้า Indexing จะตอบ 503

```bash
docker compose down        # ปิดระบบ (ข้อมูลยังอยู่)
docker compose down -v     # ลบข้อมูลทั้งหมด (ครั้งหน้าจะ seed ใหม่)
```

### วิธีที่ 2: รันแบบ Manual

ต้องมี Node.js 18 ขึ้นไป และ MongoDB ที่รันอยู่ (บนเครื่องหรือ Atlas)

```bash
npm install
# Windows PowerShell: $env:ADMIN_ACCOUNTS="admin:admin1234"; npm start
ADMIN_ACCOUNTS="admin:admin1234" npm start
```

เปิด http://localhost:3000

### วิธีที่ 3: Deploy Backend บน Render.com

ตั้งค่าที่ **Render Dashboard → Environment** ให้ครบ **ก่อน** deploy

| ตัวแปร | ตัวอย่าง |
|---|---|
| `MONGO_URI` | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/aeris_db?retryWrites=true&w=majority` |
| `JWT_SECRET` | ข้อความสุ่มยาว ๆ |
| `ADMIN_ACCOUNTS` | `รหัสพนักงาน:รหัสผ่าน,รหัสพนักงาน:รหัสผ่าน` |
| `ORDER_SEED_COUNT` | `100000` (แนะนำสำหรับ Atlas แผนฟรี) |

> 💡 ทดสอบหน้าเว็บกับ Backend ตัวอื่นได้ โดยต่อท้าย URL ด้วย `?api=` เช่น `index.html?api=http://localhost:3000`

---

## 🔐 Environment Variables

| ตัวแปร | จำเป็น | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `MONGO_URI` | ✅ (Render) | `mongodb://127.0.0.1:27017/hvacr_db` | ที่อยู่ฐานข้อมูล MongoDB |
| `JWT_SECRET` | ✅ | `dev_only_change_me` | คีย์สำหรับเซ็น JWT (โค้ดไม่บังคับให้ตั้ง ถ้าไม่ตั้งจะใช้ค่าเริ่มต้นที่ใครก็รู้ ดูหัวข้อ "ข้อควรระวังด้านความปลอดภัย") |
| `ADMIN_ACCOUNTS` | ✅ | – | บัญชีแอดมิน รูปแบบ `user:pass,user:pass` สร้างเฉพาะบัญชีที่ยังไม่มีตอน server start (ไม่ทับรหัสผ่านเดิม) |
| `ORDER_SEED_COUNT` | | `100000` (โค้ด) / `200000` (`docker-compose.yml`) / `100000` (`.env.example`) | จำนวน orders จำลองสำหรับหน้า Indexing |
| `CORS_ORIGINS` | | – | origin เพิ่มเติมที่อนุญาต คั่นด้วย `,` |
| `GOOGLE_SCRIPT_URL` | | (ค่าในโค้ด) | Webhook สำหรับส่งอีเมล |
| `PORT` | | `3000` | พอร์ตของ API |

> ⚠️ ห้าม commit ไฟล์ `.env` หรือใส่รหัสผ่านไว้ในโค้ด (`.gitignore` กันไว้ให้แล้ว)

---

## 📡 API Endpoints

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/health` | – | สถานะระบบและการเชื่อมต่อฐานข้อมูล |
| POST | `/api/auth/register` | – | สมัครสมาชิก `{ name, email, password }` |
| POST | `/api/auth/login` | – | เข้าสู่ระบบ `{ email, password }` |
| POST | `/api/auth/admin-login` | – | เข้าสู่ระบบแอดมิน `{ username, password }` |
| GET | `/api/auth/me` | User | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/api/auth/change-password` | User | เปลี่ยนรหัสผ่าน `{ oldPassword, newPassword }` |
| POST | `/api/auth/logout` | – | ตอบกลับอย่างเดียว (หน้าเว็บลบ Token ฝั่งเครื่องเอง) |
| GET | `/api/products?type=` | – | รายการสินค้า (กรองตามประเภทได้) |
| GET | `/api/products/recommend?btu=` | – | รุ่นที่แนะนำตาม BTU |
| GET | `/api/products/:pid` | – | สินค้า 1 รายการ |
| POST | `/api/simulations` | – | คำนวณ BTU ฝั่ง server + บันทึกผล |
| GET | `/api/simulations/stats` | Admin | สถิติ BTU ที่ลูกค้าจำลอง |
| POST | `/api/bookings` | – | สร้างการนัดหมาย (+ ส่งอีเมลยืนยัน) |
| GET | `/api/bookings` | User / Admin | ลูกค้าเห็นของตัวเอง แอดมินกรองตาม `status`, `phone` ได้ |
| PATCH | `/api/bookings/:id/status` | Admin | เปลี่ยนสถานะงาน |
| POST | `/api/send-booking-email` | User | ส่งอีเมลยืนยันการจอง `{ to?, subject?, message?, bookingDetails? }` (path เดิม `/send-booking-email` ก็ยังใช้ได้) |
| GET | `/api/orders/history/:customerId` | Admin | ประวัติการซื้อของลูกค้า |
| GET | `/api/index-lab/tests` | Admin | รายการชุดทดสอบ index |
| POST | `/api/index-lab/explain` | Admin | เทียบ query มี/ไม่มี index `{ testId }` |
| GET | `/api/index-lab/indexes` | Admin | index ทั้งหมด + ขนาด + จำนวนครั้งที่ถูกใช้ |
| GET | `/api/index-lab/cardinality` | Admin | จำนวนค่าที่ไม่ซ้ำของแต่ละ field |
| POST | `/api/index-lab/insert-cost` | Admin | เทียบเวลา INSERT เมื่อจำนวน index ต่างกัน `{ n }` |

endpoint ที่ต้องมีสิทธิ์ต้องส่ง header `Authorization: Bearer <token>`

> ℹ️ ตอนนี้หน้าเว็บเรียกใช้เฉพาะ: `/health`, `/auth/register`, `/auth/login`, `/auth/admin-login`, `GET /products`, `POST /simulations`, `POST /bookings` และ `/index-lab/*` ส่วน endpoint อื่น (`/auth/me`, `/auth/change-password`, `GET /bookings`, `PATCH /bookings/:id/status`, `/simulations/stats`, `/products/recommend`, `/products/:pid`, `/orders/history/:customerId`, `/send-booking-email`) **มีแต่ API ยังไม่มีหน้าจอรองรับ** เช่น "นัดหมายของฉัน" และหน้าจัดการงานของแอดมิน เรียกใช้ผ่าน API ได้โดยตรง

---

## 🔑 Database Indexing

### Index ที่ใช้ในระบบ (ประกาศใน `models.js`)

| Collection | Index | ใช้กับ |
|---|---|---|
| users | `{ username: 1 }` unique | เข้าสู่ระบบ / กันชื่อซ้ำ |
| users | `{ email: 1 }` sparse | เข้าสู่ระบบด้วย `$or` (อีเมลหรือ username) |
| products | `{ pid: 1 }` unique | ดึงสินค้า 1 รายการ |
| products | `{ type: 1, sortOrder: 1 }` | ปุ่มกรองประเภทสินค้า |
| products | `{ imgType: 1, btuNum: 1, price: 1 }` | Simulator แนะนำรุ่น |
| bookings | `{ status: 1, createdAt: -1 }` | แอดมินดูงานรอยืนยันล่าสุด |
| bookings | `{ phone: 1, createdAt: -1 }` | ค้นการจองจากเบอร์โทร |
| bookings | `{ userId: 1, createdAt: -1 }` partial | "นัดหมายของฉัน" |
| simulations | `{ createdAt: 1 }` TTL 90 วัน | ลบ log เก่าอัตโนมัติ |
| simulations | `{ targetBTU: 1 }` | สถิติ BTU |
| orders | `{ customerId: 1, orderDate: -1 }` | ประวัติการซื้อ (Leftmost rule) |
| orders | `{ orderDate: 1 }` | รายงานยอดขายตามวัน / ช่วงวัน |
| orders | `{ status: 1, orderDate: 1 }` | รายการค้างชำระ (Equality → Range) |

**ตั้งใจไม่ทำ index:** ใน orders คือ `amount`, `province`, `orderNo`, `productPid`, `btuNum` เพราะไม่ค่อยถูกค้นหา และ index ทุกตัวทำให้ INSERT ช้าลงและใช้พื้นที่เพิ่ม

### หลักการเลือก index
1. ทำเฉพาะ field ที่ถูกค้นหา กรอง หรือเรียงลำดับบ่อยจริง
2. field ที่ค่าหลากหลาย (cardinality สูง) ได้ประโยชน์มากกว่า field ที่มีไม่กี่ค่า
3. Composite index ใช้ได้เมื่อ query เริ่มจาก field ซ้ายสุด (Leftmost rule)
4. ใน composite index ให้ field ที่เทียบ "เท่ากับ" อยู่หน้า field ที่เป็น "ช่วง" (กฎ ESR: Equality → Sort → Range)

### วิธีทดสอบ
ระบบรัน query เดียวกัน 2 แบบ แล้วเทียบผลจาก `explain("executionStats")` (เทียบได้กับ `EXPLAIN ANALYZE` ใน PostgreSQL)

| แบบ | วิธี | เทียบกับ Lab PostgreSQL |
|---|---|---|
| มี Index | ให้ MongoDB เลือก index เอง | `pg_with_index` |
| ไม่มี Index | บังคับ `.hint({ $natural: 1 })` อ่านทุก document (COLLSCAN) | `pg_no_index` (Seq Scan) |

ชุดทดสอบในหน้า Indexing:

| ชุดทดสอบ | อ้างอิง | ผลที่คาดหวัง |
|---|---|---|
| ประวัติการซื้อของลูกค้า | ใช้งานจริง | IXSCAN บน `idx_order_cust_date` ไม่ต้อง SORT |
| ยอดขายวันเดียว | Lab 01 | IXSCAN อ่านแค่ ~0.3% ของข้อมูล |
| ช่วงแคบ 7 วัน | Lab 01 | index ช่วยมาก |
| ช่วงกว้าง 6 เดือน | Lab 01 | index ช่วยน้อยหรือช้ากว่า เพราะต้องอ่านครึ่งหนึ่งของข้อมูล |
| ค้างชำระตั้งแต่ 1 ก.ย. | Workshop | IXSCAN บน composite `status + orderDate` |
| ครอบ field ด้วย function | Lab 04 | COLLSCAN ทั้งคู่ |
| ค้น field ที่ไม่มี index | Lab 04 | COLLSCAN ทั้งคู่ |
| ข้าม field ซ้ายสุดของ composite | Lab 05 | ต้องไล่อ่าน key ทั้ง index |
| Login ด้วย `$or` | ใช้งานจริง | OR → IXSCAN × 2 |

ค่าที่ควรดูในผลลัพธ์:
- **Plan**: `IXSCAN` = ใช้ index, `COLLSCAN` = อ่านทุก document
- **docsExamined**: จำนวน document ที่ต้องอ่าน ยิ่งใกล้ "ได้ผลลัพธ์" ยิ่งดี
- **executionTimeMillis**: เวลาที่ใช้รัน query บนฐานข้อมูล

---

## ⚠️ ข้อควรระวังด้านความปลอดภัย

พฤติกรรมของโค้ดปัจจุบันที่ควรรู้ก่อนนำขึ้นใช้งานจริง

- **`JWT_SECRET`**: ถ้าไม่ตั้ง ระบบใช้ `dev_only_change_me` (หรือ `change_me_in_env_file` ใน `docker-compose.yml`) ใครรู้ค่านี้ก็ปลอม Token ที่มีสิทธิ์แอดมินได้ ต้องตั้งค่าสุ่มยาว ๆ ก่อนใช้งานจริงทุกครั้ง
- **`.env.example` / `docker-compose.yml`**: ค่าตัวอย่างของ `ADMIN_ACCOUNTS` (`CHANGE_ME`, `admin:admin1234`) ต้องแก้ก่อนใช้งานจริง และ Mongo Express (`admin` / `pass`) กับพอร์ต MongoDB `27017` เปิดไว้สำหรับเครื่องพัฒนาเท่านั้น
- **การสร้างแอดมิน**: ถ้า username ใน `ADMIN_ACCOUNTS` มีผู้ใช้สมัครไว้แล้ว ตอน server start ระบบจะเลื่อนผู้ใช้คนนั้นเป็นแอดมิน (ใช้รหัสผ่านของเขาเอง) และ API สมัครสมาชิกไม่ตรวจรูปแบบอีเมล จึงควรสร้างแอดมินก่อนเปิดให้สมัครสมาชิก และไม่ใช้รหัสพนักงานที่เดาง่ายซึ่งยังไม่ถูกสร้าง
- **`POST /api/send-booking-email`**: ผู้ใช้ที่ล็อกอินแล้วทุกคนส่งอีเมลไปยังที่อยู่ใดก็ได้ พร้อมหัวเรื่องและข้อความที่กำหนดเอง ผ่านบัญชี Google ของเจ้าของ Webhook เนื่องจากเปิดให้สมัครสมาชิกได้อิสระ ควรจำกัดสิทธิ์หรือ rate limit ก่อนใช้งานจริง
- **`GOOGLE_SCRIPT_URL`**: มีค่าเริ่มต้นเขียนไว้ในโค้ด (`server.js`) ควรตั้งผ่าน env ของตัวเอง และไม่ควรเผยแพร่ URL ของ Webhook ที่ใช้งานจริง

---

## 🛠️ ปัญหาที่พบบ่อย

- **กด Login แล้วขึ้น "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์"**: Backend บน Render อาจกำลังตื่น ให้รอ 30–60 วินาทีแล้วลองใหม่ หรือเปิด `/api/health` เช็กสถานะ
- **ขึ้น "เซิร์ฟเวอร์กำลังเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง"** (503): API ยังต่อ MongoDB หรือ seed ส่วนหลักไม่เสร็จ ให้รอจนใน log ขึ้น `✅ ระบบพร้อมใช้งาน` (ระบบลองเชื่อมต่อใหม่เองสูงสุด 10 ครั้ง ห่างกัน 5 วินาที)
- **หน้า Indexing ขึ้น "กำลังเตรียมข้อมูล orders สำหรับทดสอบ index"** (503): ระบบกำลัง seed orders ครั้งแรก ให้รอจน log ขึ้น `✅ หน้า Indexing พร้อมใช้งาน` ถ้า seed ล้มเหลวกลางทาง (เช่น Atlas แผนฟรีพื้นที่ไม่พอ) ระบบจะไม่ลองใหม่ ต้อง restart server และลดค่า `ORDER_SEED_COUNT`
- **ล็อกอินแอดมินไม่ได้**: ตรวจว่าตั้ง `ADMIN_ACCOUNTS` แล้ว (บัญชีถูกสร้างตอน server start) และถ้าบัญชีนั้นเคยถูกสร้างไปแล้ว การแก้รหัสผ่านใน `ADMIN_ACCOUNTS` ทีหลัง **ไม่เปลี่ยนรหัสผ่านใน DB** ต้อง `docker compose down -v` เพื่อล้างข้อมูลก่อน หรือแก้ใน MongoDB โดยตรง
- **port 3000 / 27017 is already allocated**: เครื่องมีโปรแกรมใช้พอร์ตนี้อยู่ ให้แก้ `ports` ใน `docker-compose.yml` เช่น `"3001:3000"`
- **เมนู Indexing ไม่ขึ้น**: เมนูนี้แสดงเฉพาะตอนเข้าสู่ระบบด้วยแท็บผู้ดูแลระบบ
- **ต้องการ seed orders ใหม่**: `docker compose down -v` แล้ว `up -d` ใหม่ หรือรัน `npm run seed:reset`
