"""
Core security module implementing comprehensive authentication, authorization,
encryption, and security monitoring features for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError  # version: 3.3.0
from passlib.context import CryptContext  # version: 1.7.4
from cryptography.fernet import Fernet  # version: 37.0.0
import redis  # version: 4.5.0

from ..config import settings
from ..utils.logging import logger

# Initialize password context with bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Initialize Redis client for rate limiting and token blacklist
redis_client = redis.Redis(
    host=settings.REDIS_CONFIG["host"],
    port=settings.REDIS_CONFIG["port"],
    db=0,
    decode_responses=True
)

# Initialize Fernet for symmetric encryption
fernet = Fernet(settings.SECURITY_CONFIG["encryption_key"].encode())

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password using bcrypt.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password for comparison
    
    Returns:
        bool: True if password matches hash, False otherwise
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error("Password verification failed", extra={"error": str(e)})
        return False

def get_password_hash(password: str) -> str:
    """
    Generate password hash using bcrypt with secure settings.
    
    Args:
        password: Plain text password to hash
    
    Returns:
        str: Hashed password string
    """
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token with enhanced security features.
    
    Args:
        data: Payload data for token
        expires_delta: Optional expiration time delta
    
    Returns:
        str: Encoded JWT token
    """
    # Check rate limit for token creation
    if not check_rate_limit("token_creation", data.get("sub", "unknown")):
        logger.warning("Token creation rate limit exceeded", 
                      extra={"user": data.get("sub", "unknown")})
        raise ValueError("Token creation rate limit exceeded")

    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta 
        else timedelta(minutes=settings.SECURITY_CONFIG["access_token_expire_minutes"])
    )
    
    # Add security claims
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": f"{data.get('sub', 'unknown')}_{datetime.utcnow().timestamp()}",
        "type": "access"
    })
    
    try:
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECURITY_CONFIG["jwt_secret"],
            algorithm=settings.SECURITY_CONFIG["jwt_algorithm"]
        )
        logger.info("Access token created", extra={"user": data.get("sub", "unknown")})
        return encoded_jwt
    except Exception as e:
        logger.error("Token creation failed", extra={"error": str(e)})
        raise

def verify_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode JWT token with enhanced security checks.
    
    Args:
        token: JWT token string
    
    Returns:
        dict: Decoded token payload
    """
    try:
        # Check rate limit for verification attempts
        if not check_rate_limit("token_verification", token[:32]):
            logger.warning("Token verification rate limit exceeded")
            raise ValueError("Token verification rate limit exceeded")

        # Check token blacklist
        if redis_client.sismember("token_blacklist", token):
            logger.warning("Blacklisted token used", extra={"token_prefix": token[:32]})
            raise ValueError("Token has been blacklisted")

        payload = jwt.decode(
            token,
            settings.SECURITY_CONFIG["jwt_secret"],
            algorithms=[settings.SECURITY_CONFIG["jwt_algorithm"]]
        )
        
        # Verify token claims
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
            
        logger.info("Token verified successfully", 
                   extra={"user": payload.get("sub", "unknown")})
        return payload
        
    except JWTError as e:
        logger.error("Token verification failed", extra={"error": str(e)})
        raise ValueError("Invalid token")
    except Exception as e:
        logger.error("Token verification error", extra={"error": str(e)})
        raise

def encrypt_sensitive_data(data: str) -> str:
    """
    Encrypt sensitive data using Fernet symmetric encryption.
    
    Args:
        data: String data to encrypt
    
    Returns:
        str: Encrypted data string
    """
    try:
        if not data:
            raise ValueError("Data to encrypt cannot be empty")
            
        encrypted_data = fernet.encrypt(data.encode())
        logger.info("Data encrypted successfully")
        return encrypted_data.decode()
        
    except Exception as e:
        logger.error("Data encryption failed", extra={"error": str(e)})
        raise

def decrypt_sensitive_data(encrypted_data: str) -> str:
    """
    Decrypt sensitive data using Fernet symmetric encryption.
    
    Args:
        encrypted_data: Encrypted string to decrypt
    
    Returns:
        str: Decrypted data string
    """
    try:
        if not encrypted_data:
            raise ValueError("Encrypted data cannot be empty")
            
        decrypted_data = fernet.decrypt(encrypted_data.encode())
        logger.info("Data decrypted successfully")
        return decrypted_data.decode()
        
    except Exception as e:
        logger.error("Data decryption failed", extra={"error": str(e)})
        raise

def check_rate_limit(operation_key: str, identifier: str) -> bool:
    """
    Check rate limit for security operations.
    
    Args:
        operation_key: Type of operation being rate limited
        identifier: Unique identifier for the rate limit subject
    
    Returns:
        bool: True if within limit, False if exceeded
    """
    try:
        key = f"rate_limit:{operation_key}:{identifier}"
        count = redis_client.get(key)
        
        if count is None:
            # Initialize counter
            redis_client.setex(
                key,
                settings.SECURITY_CONFIG["rate_limit_period"],
                1
            )
            return True
            
        count = int(count)
        if count >= settings.SECURITY_CONFIG["rate_limit_requests"]:
            logger.warning("Rate limit exceeded", 
                         extra={"operation": operation_key, "identifier": identifier})
            return False
            
        # Increment counter
        redis_client.incr(key)
        return True
        
    except Exception as e:
        logger.error("Rate limit check failed", extra={"error": str(e)})
        # Fail open to prevent blocking legitimate requests
        return True

def log_security_event(event_type: str, message: str, additional_data: Dict[str, Any]) -> None:
    """
    Log security-related events with proper severity.
    
    Args:
        event_type: Type of security event
        message: Event message
        additional_data: Additional event data
    """
    try:
        sanitized_data = {k: "[REDACTED]" if k in ["password", "token"] else v 
                         for k, v in additional_data.items()}
        
        log_data = {
            "event_type": event_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "data": sanitized_data
        }
        
        if event_type.startswith("error"):
            logger.error(message, extra=log_data)
        elif event_type.startswith("warning"):
            logger.warning(message, extra=log_data)
        else:
            logger.info(message, extra=log_data)
            
    except Exception as e:
        logger.error("Failed to log security event", extra={"error": str(e)})