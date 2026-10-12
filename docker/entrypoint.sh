#!/bin/sh
set -e
mkdir -p /data/uploads
npx prisma db push --skip-generate
COUNT=$(node -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.user.count().then((c)=>{console.log(c); return p.$disconnect();}).catch((e)=>{console.error(e); process.exit(1);})')
if [ "$COUNT" = "0" ]; then
  echo "Loading Harbourline demo data"
  npx tsx prisma/seed.ts
fi
exec npx next start -H 0.0.0.0 -p 3000
