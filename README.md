# How to Run

1. make dev
2. open http://localhost:7331/dashboard

## Deployment

1. point railway to project
2. setup env vars
3. setup ses identity
4. setup domain records
5. create lambda with code in lambda/bounced-handler.js
6. hook lambda into sns trigger
7. set secure password on lambda env
