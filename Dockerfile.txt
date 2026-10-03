# ⚠️ ใน repo ให้บันทึกไฟล์นี้ชื่อ "Dockerfile" (ไม่มีนามสกุล) แทนไฟล์เดิม
# ใช้ Node.js 20 (LTS) — Node 18 หมดอายุการซัพพอร์ตแล้ว
FROM node:20-alpine

# กำหนดโฟลเดอร์ทำงานภายใน Container
WORKDIR /app

# ก๊อปปี้ package.json มาติดตั้ง dependencies ก่อน (ใช้ cache ได้ถ้า package.json ไม่เปลี่ยน)
COPY package*.json ./
RUN npm install --omit=dev

# ก๊อปปี้โค้ดทั้งหมด: server.js, models.js, seed.js, indexLab.js, index.html
COPY . .

ENV NODE_ENV=production \
    PORT=3000

# แจ้งว่าจะใช้พอร์ต 3000
EXPOSE 3000

# ตรวจว่า API ยังตอบอยู่ (docker ps จะขึ้น healthy)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# คำสั่งสำหรับรัน Server
CMD ["npm", "start"]
