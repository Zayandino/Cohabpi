# Stage 1: Build React App
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY cohab-frontend/package*.json ./cohab-frontend/
WORKDIR /app/cohab-frontend
RUN npm install

# Copy application source
COPY cohab-frontend/ ./

# Accept build arguments for Supabase (Vite requires these during build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build the production bundle
RUN npm run build

# Stage 2: Serve compiled SPA using Nginx
FROM nginx:alpine

# Remove default nginx config and copy our custom SPA config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output from Stage 1 and public config.js from root
COPY --from=build /app/cohab-frontend/dist /usr/share/nginx/html
COPY config.js /usr/share/nginx/html/

# Expose port 80 and start Nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
