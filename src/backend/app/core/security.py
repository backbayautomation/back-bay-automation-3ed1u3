"""
Core security module implementing comprehensive authentication, authorization,
encryption, and security monitoring features for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt  # version: 3.3.0
from passlib.context import CryptContext  # version: 1.7.4
from cryptography.fernet import Fernet  # version: 37.0.0
import redis  # version: 4.5.0

from ..config import settings
from ..utils.logging import logger

# Initialize security components
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
redis_client = redis.Redis(
    host=settings.get_database_settings().get('host', 'localhost'),
    port=6379,
    db=0,
    decode_responses=True
)

# Initialize Fernet encryption
ENCRYPTION_KEY = settings.SECURITY_CONFIG.get('encryption_key').encode()
fernet = Fernet(ENCRYPTION_KEY)

# Security constants
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
MAX_ATTEMPTS = settings.SECURITY_CONFIG.get('max_login_attempts', 5)
TOKEN_BLACKLIST_PREFIX = "token_blacklist:"
RATE_LIMIT_PREFIX = "rate_limit:"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password using bcrypt.
    
    Args:
        plain_password: The plain text password to verify
        hashed_password: The hashed password to compare against
        
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
        data: Payload data to encode in token
        expires_delta: Optional custom expiration time
        
    Returns:
        str: Encoded JWT token
    """
    if not check_rate_limit("token_creation", data.get("sub", "unknown")):
        logger.warning("Rate limit exceeded for token creation", 
                      extra={"user": data.get("sub")})
        raise ValueError("Token creation rate limit exceeded")

    try:
        to_encode = data.copy()
        expire = datetime.utcnow() + (
            expires_delta or 
            timedelta(minutes=settings.SECURITY_CONFIG.get('access_token_expire_minutes', 30))
        )
        
        # Add security claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECURITY_CONFIG['jwt_secret'],
            algorithm=settings.SECURITY_CONFIG['jwt_algorithm']
        )
        
        logger.info("Access token created", 
                   extra={"user": data.get("sub"), "expires": expire.isoformat()})
        return encoded_jwt
        
    except Exception as e:
        logger.error("Token creation failed", extra={"error": str(e)})
        raise

def verify_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode JWT token with enhanced security checks.
    
    Args:
        token: JWT token to verify
        
    Returns:
        dict: Decoded token payload
    """
    try:
        # Check token blacklist
        if redis_client.get(f"{TOKEN_BLACKLIST_PREFIX}{token}"):
            raise jwt.JWTError("Token has been blacklisted")
            
        payload = jwt.decode(
            token,
            settings.SECURITY_CONFIG['jwt_secret'],
            algorithms=[settings.SECURITY_CONFIG['jwt_algorithm']]
        )
        
        # Verify token claims
        if payload.get("type") != "access":
            raise jwt.JWTError("Invalid token type")
            
        logger.info("Token verified successfully", 
                   extra={"user": payload.get("sub")})
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Expired token detected", extra={"token": token[:10]})
        raise
    except jwt.JWTError as e:
        logger.error("Token verification failed", extra={"error": str(e)})
        raise
    except Exception as e:
        logger.error("Unexpected error in token verification", 
                    extra={"error": str(e)})
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
        identifier: Unique identifier for the rate limit (e.g., user ID, IP)
        
    Returns:
        bool: True if within limit, False if exceeded
    """
    try:
        key = f"{RATE_LIMIT_PREFIX}{operation_key}:{identifier}"
        current = redis_client.get(key)
        
        if current is None:
            redis_client.setex(key, RATE_LIMIT_WINDOW, 1)
            return True
            
        count = int(current)
        if count >= MAX_ATTEMPTS:
            logger.warning("Rate limit exceeded", 
                         extra={"operation": operation_key, "identifier": identifier})
            return False
            
        redis_client.incr(key)
        return True
        
    except Exception as e:
        logger.error("Rate limit check failed", 
                    extra={"error": str(e), "operation": operation_key})
        return False

def log_security_event(event_type: str, message: str, additional_data: Dict[str, Any]) -> None:
    """
    Log security-related events with proper severity.
    
    Args:
        event_type: Type of security event
        message: Event description
        additional_data: Additional context for the event
    """
    try:
        log_data = {
            "event_type": event_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            **additional_data
        }
        
        if "error" in event_type.lower() or "failure" in event_type.lower():
            logger.error(message, extra=log_data)
        elif "warning" in event_type.lower():
            logger.warning(message, extra=log_data)
        else:
            logger.info(message, extra=log_data)
            
    except Exception as e:
        logger.error("Failed to log security event", 
                    extra={"error": str(e), "event_type": event_type})