# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias (incluyendo devDependecies para tsc)
RUN npm install

# Copiar el resto del código
COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
# Generar cliente de Prisma
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

# Stage 2: Producción
FROM node:20-alpine AS runner

WORKDIR /app

# Copiar archivos compilados y módulos desde stage builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Script de arranque
CMD ["npm", "start"]
