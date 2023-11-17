# Dockerfile
# Use an official Node.js runtime as a base image
FROM node:14

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application files to the container
COPY . .

# Expose the port that the application will run on
EXPOSE 1997

# Define the command to run the application
CMD ["node", "index.js"]
