import socket
import ipaddress
import urllib.parse
import http.client
import logging
from typing import List, Tuple
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Explicit cloud metadata & blocked hosts
BLOCKED_HOSTS = {
    "localhost",
    "metadata.google.internal",
    "169.254.169.254",
    "100.100.100.200",
}

def is_safe_ip(ip_str: str) -> bool:
    """
    Validate that an IP string is a globally routable, non-private, non-loopback address.
    Supports both IPv4 and IPv6.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
        
        # Explicitly check IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            return is_safe_ip(str(ip.ipv4_mapped))
            
        return True
    except ValueError:
        return False


def validate_hostname_ips(hostname: str) -> List[str]:
    """
    Resolve all IP addresses (IPv4 & IPv6) for a hostname and verify all are safe.
    Raises HTTPException(400) if hostname resolves to private/internal IP.
    """
    if hostname.lower() in BLOCKED_HOSTS:
        raise HTTPException(status_code=400, detail="Access to internal/metadata endpoints is strictly forbidden")

    # If hostname is already an IP address, validate directly
    try:
        if not is_safe_ip(hostname):
            raise HTTPException(status_code=400, detail="Access to private or local network IP addresses is forbidden")
        return [hostname]
    except Exception:
        pass

    try:
        # Resolve both IPv4 and IPv6
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail=f"Failed to resolve host '{hostname}': {e}")

    resolved_ips = []
    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip = sockaddr[0]
        if not is_safe_ip(ip):
            logger.warning(f"SSRF Alert: Hostname '{hostname}' resolved to restricted IP '{ip}'")
            raise HTTPException(
                status_code=400, 
                detail="Access to private, local, or cloud metadata network addresses is forbidden"
            )
        resolved_ips.append(ip)

    if not resolved_ips:
        raise HTTPException(status_code=400, detail=f"No valid IP address found for host '{hostname}'")

    return resolved_ips


def validate_safe_url(url: str) -> str:
    """
    Perform deep validation on a target URL before fetching:
    1. Scheme check (strictly http/https).
    2. Hostname extraction & DNS resolution checks against SSRF blocklist.
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only HTTP and HTTPS URLs are supported")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: Missing hostname")

    validate_hostname_ips(hostname)
    return url


def safe_fetch_text(url: str, timeout: float = 8.0, max_redirects: int = 3, max_bytes: int = 10 * 1024 * 1024) -> Tuple[str, str]:
    """
    Safely fetch HTML/text content from a URL:
    - Validates DNS/IP for initial request AND every redirect hop.
    - Limits max redirects to prevent redirect loops.
    - Limits response payload size to 10MB to prevent memory exhaustion.
    Returns (final_url, response_text).
    """
    import requests

    current_url = validate_safe_url(url)
    session = requests.Session()
    session.headers.update({"User-Agent": "ShiroAI-DocumentIngestion/2.5 (+https://shiro.ai)"})

    for redirect_count in range(max_redirects + 1):
        validate_safe_url(current_url)
        try:
            resp = session.get(current_url, timeout=timeout, allow_redirects=False, stream=True)
        except requests.RequestException as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch content from URL: {e}")

        # Check for redirect status codes (301, 302, 303, 307, 308)
        if resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("Location")
            if not location:
                raise HTTPException(status_code=400, detail="Redirect location header missing")
            # Resolve relative redirect URLs
            next_url = urllib.parse.urljoin(current_url, location)
            # Re-validate the destination URL
            current_url = validate_safe_url(next_url)
            continue

        # If we reached this point, it's the final non-redirect response
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Server returned HTTP status {resp.status_code}")

        # Read content safely with size limit
        content_chunks = []
        bytes_read = 0
        for chunk in resp.iter_content(chunk_size=65536, decode_unicode=True):
            if chunk:
                bytes_read += len(chunk.encode('utf-8', errors='ignore'))
                if bytes_read > max_bytes:
                    raise HTTPException(status_code=400, detail="Response exceeds maximum allowed size (10MB)")
                content_chunks.append(chunk)

        return current_url, "".join(content_chunks)

    raise HTTPException(status_code=400, detail="Exceeded maximum allowed redirects (3)")

