FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=base /app/dist ./dist
EXPOSE 3000 8787
CMD ["node", "dist/start-all.js"]
