import jwt

token = jwt.encode(
    {"email": "test@example.com"},
    "supersecretkey123",
    algorithm="HS256"
)

print(token)
