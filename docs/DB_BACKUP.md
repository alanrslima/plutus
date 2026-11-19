# Backup do banco de dados

O script `backend/scripts/db-backup.sh` gera um dump do PostgreSQL do Plutos.

## Uso rápido

```bash
cd backend
npm run db:backup
```

O arquivo é salvo em `backend/backups/plutos_AAAAmmdd_HHMMSS.dump`. A pasta `backups/` está no `.gitignore`, então os dumps nunca vão para o repositório.

## Opções

As opções são passadas por variáveis de ambiente:

| Variável       | Padrão              | Descrição                                                         |
| -------------- | ------------------- | ----------------------------------------------------------------- |
| `KEEP`         | `0`                 | Quantos backups manter. Os mais antigos são apagados. `0` = todos |
| `BACKUP_DIR`   | `backend/backups`   | Pasta onde os dumps são salvos                                    |
| `CONTAINER`    | `plutos-postgres`   | Nome do container Docker do Postgres                              |
| `DATABASE_URL` | lido do `backend/.env` | Usado quando o container não está rodando                      |

Exemplos:

```bash
KEEP=10 npm run db:backup                 # mantém só os 10 mais recentes
BACKUP_DIR=~/Backups/plutos npm run db:backup
```

## Como funciona

1. Se o container `plutos-postgres` estiver rodando, o script usa o `pg_dump` de dentro dele. Não é preciso ter o client do Postgres instalado na máquina.
2. Se o container não estiver rodando, usa o `pg_dump` local com o `DATABASE_URL` do `backend/.env` (parâmetros como `?schema=public` são removidos).
3. Se nenhum dos dois estiver disponível, o script falha com uma mensagem explicando o que fazer.

O dump usa o formato custom do Postgres (`-Fc`, já comprimido) com `--no-owner --no-privileges`, para poder ser restaurado em outro banco ou usuário.

O dump é escrito primeiro em um arquivo `.partial` e só é renomeado se terminar sem erro e não estiver vazio. Um backup interrompido no meio não fica com cara de válido.

## Restaurar um backup

> ⚠️ A restauração **substitui** os dados atuais do banco. Considere fazer um backup antes.

Com o container rodando:

```bash
cd backend
docker exec -i plutos-postgres pg_restore -U postgres -d plutos --clean --if-exists < backups/<arquivo>.dump
```

Com o `pg_restore` local:

```bash
pg_restore -d "postgresql://postgres:postgres@localhost:5432/plutos" --clean --if-exists backups/<arquivo>.dump
```

Para conferir o conteúdo de um dump sem restaurar:

```bash
docker exec -i plutos-postgres pg_restore --list < backups/<arquivo>.dump
```

## Agendar backups automáticos (opcional)

Para rodar todo dia às 3h via `cron` (`crontab -e`):

```cron
0 3 * * * cd /caminho/para/plutos/backend && KEEP=14 ./scripts/db-backup.sh >> backups/backup.log 2>&1
```
