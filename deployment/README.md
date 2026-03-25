# Deployment

## Integrated App (frontend + backend)

```bash
cd deployment
docker compose up -d backend frontend
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`

## Chain Profile (optional)

```bash
cd deployment
docker compose --profile chain up -d relaychain parachain
```

Then run bootstrap checks:

```bash
cd deployment
npm install
npm run setup-chain
```

## One-command bootstrap

```bash
sh deploy-parachain.sh
```
