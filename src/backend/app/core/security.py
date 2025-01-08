"""
Core security module implementing comprehensive authentication, authorization,
encryption, and security monitoring features for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from passlib.context import CryptContext  # version: 1.7.4
from jose import jwt, JWTError  # version: 3.3.0
from cryptography.fernet import Fernet  # version: 37.0.0
import redis  # version: 4.5.0
import os

from ..config import settings
from ..utils.logging import logger

# Initialize security components
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,
    decode_responses=True
)

# Generate encryption key if not exists
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
fernet = Fernet(ENCRYPTION_KEY)

# Rate limiting configuration
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
MAX_REQUESTS = 1000  # Maximum requests per window

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error("Password verification failed", extra={"error": str(e)})
        return False

def get_password_hash(password: str) -> str:
    """Generate password hash using bcrypt."""
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token with enhanced security features."""
    try:
        # Check rate limit
        if not check_rate_limit("token_creation", data.get("sub", "unknown")):
            raise ValueError("Rate limit exceeded for token creation")

        # Copy data to avoid mutations
        to_encode = data.copy()
        
        # Set expiration
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Add security claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })

        # Create token
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        # Log token creation
        log_security_event(
            "token_creation",
            "Access token created",
            {"user_id": data.get("sub"), "expires": expire.isoformat()}
        )

        return encoded_jwt

    except Exception as e:
        logger.error("Token creation failed", extra={"error": str(e)})
        raise

def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode JWT token with enhanced security."""
    try:
        # Check rate limit
        if not check_rate_limit("token_verification", token[:8]):
            raise ValueError("Rate limit exceeded for token verification")

        # Check token blacklist
        if redis_client.sismember("token_blacklist", token):
            raise JWTError("Token has been blacklisted")

        # Decode token
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        # Verify expiration
        if datetime.fromtimestamp(payload["exp"]) < datetime.utcnow():
            raise JWTError("Token has expired")

        log_security_event(
            "token_verification",
            "Token verified successfully",
            {"user_id": payload.get("sub")}
        )

        return payload

    except JWTError as e:
        log_security_event(
            "token_verification_failed",
            "Token verification failed",
            {"error": str(e)}
        )
        raise
    except Exception as e:
        logger.error("Token verification failed", extra={"error": str(e)})
        raise

def encrypt_sensitive_data(data: str) -> str:
    """Encrypt sensitive data using Fernet symmetric encryption."""
    try:
        if not data:
            raise ValueError("Data to encrypt cannot be empty")

        encrypted_data = fernet.encrypt(data.encode())
        
        log_security_event(
            "data_encryption",
            "Data encrypted successfully",
            {"data_length": len(data)}
        )

        return encrypted_data.decode()

    except Exception as e:
        logger.error("Data encryption failed", extra={"error": str(e)})
        raise

def decrypt_sensitive_data(encrypted_data: str) -> str:
    """Decrypt sensitive data using Fernet symmetric encryption."""
    try:
        if not encrypted_data:
            raise ValueError("Encrypted data cannot be empty")

        decrypted_data = fernet.decrypt(encrypted_data.encode())
        
        log_security_event(
            "data_decryption",
            "Data decrypted successfully",
            {"data_length": len(encrypted_data)}
        )

        return decrypted_data.decode()

    except Exception as e:
        logger.error("Data decryption failed", extra={"error": str(e)})
        raise

def check_rate_limit(operation_key: str, identifier: str) -> bool:
    """Check rate limit for security operations."""
    try:
        key = f"rate_limit:{operation_key}:{identifier}"
        current = redis_client.get(key)

        if current is None:
            redis_client.setex(key, RATE_LIMIT_WINDOW, 1)
            return True

        count = int(current)
        if count >= MAX_REQUESTS:
            log_security_event(
                "rate_limit_exceeded",
                "Rate limit exceeded",
                {"operation": operation_key, "identifier": identifier}
            )
            return False

        redis_client.incr(key)
        return True

    except Exception as e:
        logger.error("Rate limit check failed", extra={"error": str(e)})
        return False

def log_security_event(event_type: str, message: str, additional_data: Dict[str, Any]) -> None:
    """Log security-related events with proper severity."""
    try:
        event_data = {
            "event_type": event_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            **additional_data
        }

        if event_type.startswith(("token_verification_failed", "rate_limit_exceeded")):
            logger.warning("Security event", extra=event_data)
        else:
            logger.info("Security event", extra=event_data)

    except Exception as e:
        logger.error("Security event logging failed", extra={"error": str(e)})