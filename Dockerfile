# Use the official Node.js image as the base image
FROM node:22

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Build the project
RUN npm install typescript
RUN npx tsc

# Expose the port the app runs on
EXPOSE 8080

# Command to run the app
CMD ["node", "./dist/index.js"]
