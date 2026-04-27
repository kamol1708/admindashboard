# Admin Dashboard

Next.js asosidagi o'quv markaz boshqaruv paneli. Bu loyiha orqali:

- studentlar boshqariladi
- guruhlar va kurslar yuritiladi
- davomat va baholar saqlanadi
- to'lovlar nazorat qilinadi
- Telegram bot orqali xabarnomalar yuboriladi

## Texnologiyalar

- Next.js 16
- React 19
- TypeScript
- SQLite (`node:sqlite`)
- Tailwind CSS 4

## Asosiy imkoniyatlar

- Admin, teacher va student login
- Student CRUD
- Guruh va bootcamp boshqaruvi
- Enrollment va billing summary
- Davomat kiritish va lesson journal
- Telegram linklash va xabar yuborish
- Student payment request va admin approve/reject flow

## Local ishga tushirish

1. Dependency o'rnating:

```bash
npm install
```

2. Dev serverni yoqing:

```bash
npm run dev
```

3. Brauzerda oching:

```text
http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Typecheck

```bash
npm run typecheck
```

## Default admin login

`.env` dagi default qiymatlar:

- Email: `admin@hems.uz`
- Password: `Admin123!`

## Environment

Loyiha `.env` orqali ishlaydi. Muhim o'zgaruvchilar:

```env
AUTH_COOKIE_NAME=edu_admin_session
ADMIN_EMAIL=admin@hems.uz
ADMIN_PASSWORD=Admin123!
ADMIN_NAME=Azizbek Rahimov

TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=@your_bot
TELEGRAM_WEBHOOK_SECRET=your_secret
TELEGRAM_LINK_EXPIRE_MINUTES=60
APP_LOGIN_URL=http://localhost:3000/login
```

## Ma'lumotlar saqlanishi

- SQLite fayl: `data/attendance.db`
- Qo'shimcha seed/store ma'lumotlari: `data/store.json`

`data/*.db` GitHub'ga push qilinmaydi.

## Muhim eslatma

Bu loyiha hozircha ichki foydalanish va MVP darajasiga yaqin. Productionga chiqarishdan oldin:

- auth/session security kuchaytirish
- testlar qo'shish
- payment gateway integratsiya qilish
- secret managementni yaxshilash

## Repo

GitHub:

```text
https://github.com/kamol1708/admindashboard
```
