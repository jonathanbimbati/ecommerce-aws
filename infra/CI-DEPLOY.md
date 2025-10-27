CI/CD Deploy Instructions

This repository now contains a GitHub Actions workflow that builds the frontend, tags the image with `latest` and `${{ github.sha }}`, pushes both to ECR, and (optionally) deploys to Kubernetes.

Secrets to add in your GitHub repository (Settings GåÆ Secrets GåÆ Actions):

...

If you want, I can:
CI trigger note: commit generated on 2025-10-15 to trigger GitHub Actions deploy pipeline.
CI/CD Deploy Instructions

This repository now contains a GitHub Actions workflow that builds the frontend, tags the image with `latest` and `${{ github.sha }}`, pushes both to ECR, and (optionally) deploys to Kubernetes.

Secrets to add in your GitHub repository (Settings GåÆ Secrets GåÆ Actions):

- AWS_ACCESS_KEY_ID GÇö IAM user access key with permissions to push to ECR.
- AWS_SECRET_ACCESS_KEY GÇö IAM user secret key.
- AWS_REGION GÇö AWS region, e.g. `us-east-1`.
- KUBE_CONFIG GÇö (optional) base64-encoded `~/.kube/config` content for the target cluster. If provided, the workflow will run `kubectl set image` to update the `ecommerce-frontend` deployment with the new image tag.

How it works:
1. On push to `main` affecting `frontend/**`, workflow `frontend.yml` will:
   - Build the frontend (Angular) and build a Docker image.
   - Tag the image as `latest` and `${{ github.sha }}`.
   - Push both tags to ECR repo `ecommerce-ecr-frontend`.
2. If `KUBE_CONFIG` is defined, the `deploy-to-k8s` job will decode it and run:
   kubectl set image deployment/ecommerce-frontend frontend=<ECR_URI>:${{ github.sha }}
   This triggers a rolling update.

Notes & recommendations:
- The Kubeconfig must be base64-encoded before you paste it into `KUBE_CONFIG` secret. On Linux/macOS:
  base64 ~/.kube/config | pbcopy
  Then paste into the secret value.
- Ensure the IAM user used by GitHub Actions has access to ECR and to EKS (if workflow will call AWS CLI to get caller identity); for `kubectl` operations the kubeconfig should contain credentials or role assumptions as needed.
- The frontend image includes an entrypoint that reads `API_URL` from the container environment at runtime and writes `assets/env.js` so the SPA reads the correct API URL. When deploying to Kubernetes, set an env var `API_URL` in the deployment (already added in `k8s/frontend-deployment.yaml`).

Triggering a deploy manually:
- Push to `main` or run workflow manually via the GitHub UI. The `deploy-to-k8s` step will run when `KUBE_CONFIG` secret is present.

Rollback:
- To rollback, you can use `kubectl rollout undo deployment/ecommerce-frontend` or change the image tag to a previous SHA.

