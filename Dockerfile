FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile
RUN pnpm install @prisma/client

COPY . .

RUN pnpm db:generate
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "run", "dev:docker"]