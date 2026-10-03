FROM node:20-alpine

WORKDIR /app

# backend deps
COPY package.json package-lock.json ./
RUN npm install

# frontend
COPY frontendGaleria ./frontendGaleria
RUN cd frontendGaleria && npm install && npm run build

# backend files
COPY server.js .
COPY check-status.sh /check-status.sh
RUN sed -i 's/\r$//' /check-status.sh \
 && chmod +x /check-status.sh

EXPOSE 3001
CMD ["node", "server.js"]




