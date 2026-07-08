# Огород

Полный веб-дашборд (tier 2) для vault Огорода на Next.js 15.

## Быстрый старт

```bash
npm install
VAULT_PATH=/path/to/vault npm run dev
```

Открой http://localhost:3000.

## Переменные окружения

| Переменная         | Описание                                   | Обязательна |
|--------------------|--------------------------------------------|-------------|
| `VAULT_PATH`       | Путь к корню vault (папка с `projects/`)   | Да (кроме запуска прямо из корня vault — тогда берётся `process.cwd()`) |
| `DASHBOARD_PASSWORD` | Пароль для HTTP Basic Auth (если нужен) | Нет         |
| `OGOROD_APPROVE`    | Установи `1` для включения апрува задач    | Нет         |

## Сборка и запуск в продакшне

```bash
npm run build
npm start
```

## Деплой (пример: Linux + systemd + nginx)

1. Создай systemd-сервис `/etc/systemd/system/ogorod-dashboard.service`:

```ini
[Unit]
Description=Огород
After=network.target

[Service]
WorkingDirectory=/opt/ogorod-dashboard
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=VAULT_PATH=/path/to/vault
Environment=DASHBOARD_PASSWORD=yourpassword
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

2. Настрой nginx как reverse proxy:

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. Активируй:

```bash
systemctl enable ogorod-dashboard
systemctl start ogorod-dashboard
```
