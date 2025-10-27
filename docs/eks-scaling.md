## EKS Scaling – HPA e Cluster Autoscaler

Este guia explica HPA (Horizontal Pod Autoscaler) e Cluster Autoscaler no EKS.

### HPA (Horizontal Pod Autoscaler)
- Ajusta automaticamente réplicas de um Deployment com base em métricas (ex.: CPU).
- Não cria nós; apenas aumenta/diminui pods dentro da capacidade atual do cluster.
- Neste projeto: k8s/frontend-hpa.yaml (min=1, max=4, alvo 50% CPU) já incluso em k8s/kustomization.yaml.
- Pré-requisito: metrics-server instalado no cluster.

### Cluster Autoscaler (CA)
- Ajusta o tamanho do node group (ASG) para acomodar a demanda de pods.
- Se faltar capacidade para agendar pods (por ex., HPA elevou réplicas), o CA aumenta nós; reduz quando há sobra.
- Requer: IRSA habilitado, IAM Role com permissões de Auto Scaling e tags recomendadas no node group para auto-discovery.
- Instalação típica: via Helm chart oficial ou manifesto, parametrizando clusterName e awsRegion e vinculando a IAM Role via annotation na ServiceAccount.

### Notificações de escala (sem ECS)
- Como usamos EKS, notificamos “scale de nós” via EventBridge capturando eventos do AWS Auto Scaling (Launch/Terminate) do(s) ASG(s) do node group e publicando no SNS.
- Template: infra/cloudformation/eks-scale-events.yaml (parâmetros TopicArn e AutoScalingGroupNames).
- Já implantado para o node group público (us-east-1) deste ambiente.

### Operação
- Pods: HPA ajusta automaticamente quando CPU média >/< alvo.
- Nós: CA aumenta/diminui capacidade conforme necessidade de agendamento.
- Alertas: e-mails via SNS quando houver eventos de Launch/Terminate no ASG do node group.
