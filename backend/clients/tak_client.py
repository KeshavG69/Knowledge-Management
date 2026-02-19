"""
TAK Client - Connects to TAK Server and sends CoT messages

Simple send-only client with username/password authentication.
No certificates required - just username and password.
"""

import socket
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
import time

logger = logging.getLogger(__name__)


class TAKClient:
    """
    Simple TAK client for sending CoT (Cursor on Target) messages.

    Supports username/password authentication for private TAK servers.

    Usage:
        # Public server (no auth)
        client = TAKClient(host="137.184.101.250", port=8087)

        # Private server (with auth)
        client = TAKClient(
            host="tak.company.com",
            port=8089,
            username="soldieriq-agent",
            password="mypassword"
        )

        client.connect()
        client.send_cot(cot_xml_string)
        client.disconnect()
    """

    def __init__(
        self,
        host: str,
        port: int,
        username: Optional[str] = None,
        password: Optional[str] = None,
        timeout: int = 10
    ):
        """
        Initialize TAK client.

        Args:
            host: TAK server hostname or IP
            port: TAK server port (usually 8087 for TCP, 8089 for SSL)
            username: Username for authentication (optional)
            password: Password for authentication (optional)
            timeout: Connection timeout in seconds
        """
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.timeout = timeout
        self.socket: Optional[socket.socket] = None
        self.connected = False

    def connect(self) -> bool:
        """
        Connect to TAK server and authenticate if credentials provided.

        Returns:
            True if connected successfully, False otherwise
        """
        try:
            logger.info(f"Connecting to TAK server at {self.host}:{self.port}")

            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.port))

            # If username/password provided, send auth CoT message
            if self.username and self.password:
                logger.info(f"Authenticating as user: {self.username}")
                auth_success = self._send_auth()

                if not auth_success:
                    logger.error("Authentication failed")
                    self.disconnect()
                    return False

                logger.info("Authentication successful")

            self.connected = True
            logger.info("Successfully connected to TAK server")
            return True

        except socket.timeout:
            logger.error(f"Connection timeout to {self.host}:{self.port}")
            self.connected = False
            return False

        except ConnectionRefusedError:
            logger.error(f"Connection refused by {self.host}:{self.port}")
            self.connected = False
            return False

        except Exception as e:
            logger.error(f"Failed to connect to TAK server: {e}")
            self.connected = False
            return False

    def _send_auth(self) -> bool:
        """
        Send authentication CoT message to TAK server.

        Based on OpenTAKServer docs: "When ATAK connects, it will send an <auth> CoT
        with the username and password."

        Returns:
            True if auth message sent successfully
        """
        try:
            # Build auth CoT message
            now = datetime.now(timezone.utc)
            stale = now + timedelta(minutes=1)

            # Auth CoT message format
            auth_cot = f'''<?xml version="1.0" encoding="UTF-8"?>
<event version="2.0" uid="auth-{int(time.time())}" type="t-x-c-t" time="{now.isoformat()}" start="{now.isoformat()}" stale="{stale.isoformat()}" how="h-e">
    <point lat="0" lon="0" hae="0" ce="9999999" le="9999999"/>
    <detail>
        <auth username="{self.username}" password="{self.password}"/>
    </detail>
</event>'''

            # Send auth message
            message_bytes = auth_cot.encode('utf-8')
            self.socket.sendall(message_bytes)

            logger.debug("Sent authentication CoT message")

            # Give server a moment to process auth
            time.sleep(0.5)

            return True

        except Exception as e:
            logger.error(f"Failed to send auth message: {e}")
            return False

    def send_cot(self, cot_xml: str) -> bool:
        """
        Send a CoT XML message to TAK server.

        Args:
            cot_xml: CoT message in XML format

        Returns:
            True if sent successfully, False otherwise
        """
        if not self.connected or not self.socket:
            logger.error("Not connected to TAK server")
            return False

        try:
            # TAK protocol expects UTF-8 encoded XML
            message_bytes = cot_xml.encode('utf-8')
            self.socket.sendall(message_bytes)

            logger.debug(f"Sent CoT message ({len(message_bytes)} bytes)")
            return True

        except socket.timeout:
            logger.error("Timeout while sending message")
            self.connected = False
            return False

        except Exception as e:
            logger.error(f"Failed to send CoT message: {e}")
            self.connected = False
            return False

    def disconnect(self):
        """Close connection to TAK server."""
        if self.socket:
            try:
                self.socket.close()
                logger.info("Disconnected from TAK server")
            except Exception as e:
                logger.error(f"Error closing socket: {e}")
            finally:
                self.socket = None
                self.connected = False

    def __enter__(self):
        """Context manager support."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager cleanup."""
        self.disconnect()

    def is_connected(self) -> bool:
        """Check if currently connected to TAK server."""
        return self.connected and self.socket is not None


# Singleton instance for the application
_tak_client_instance: Optional[TAKClient] = None


def get_tak_client(
    host: str = None,
    port: int = None,
    username: Optional[str] = None,
    password: Optional[str] = None
) -> TAKClient:
    """
    Get or create singleton TAK client instance.

    Args:
        host: TAK server host (only used on first call)
        port: TAK server port (only used on first call)
        username: Username for authentication
        password: Password for authentication

    Returns:
        TAKClient instance
    """
    global _tak_client_instance

    if _tak_client_instance is None:
        if host is None or port is None:
            raise ValueError("host and port required for first call to get_tak_client")
        _tak_client_instance = TAKClient(
            host=host,
            port=port,
            username=username,
            password=password
        )

    return _tak_client_instance
