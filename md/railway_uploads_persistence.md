# Railway Uploads Persistence (RARE.NP)

Your server writes uploaded images to a local folder called `uploads` by default:

- Local dev default: `./uploads`

To make uploads persist across **Railway redeploys / container restarts**, set and mount a persistent volume for the uploads root.

## 1) Configure `UPLOADS_DIR`

In your Railway environment variables, set:

- `UPLOADS_DIR=/uploads`

Then ensure `server` uses the same path (it does via code changes in `server/index.ts`, `server/routes.ts`, and `server/lib/imageService.ts`).

## 2) Mount a persistent disk

In Railway:

1. Open your service.
2. Add a **Persistent Disk / Volume**.
3. Mount it to the container path: `/uploads`
4. Ensure the app has write permission to that mount.

## 3) Verify

After deploying:

1. Upload a new image from the admin UI.
2. Confirm the image URL renders normally.
3. Redeploy/restart the service.
4. Confirm previously uploaded images still render (and the files still exist under the mounted `/uploads` path).

