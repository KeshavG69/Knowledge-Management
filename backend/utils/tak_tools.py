"""
Agno Tools for TAK Integration
Tools for AI agent to interact with TAK network
"""

from typing import Optional
from agno.agent import Agent
from clients.tak_client import TAKClient
from clients.cot_builder import CoTBuilder
from app.logger import logger

# For testing: public FreeTAKServer
DEFAULT_TAK_HOST = "137.184.101.250"
DEFAULT_TAK_PORT = 8087


def create_tak_marker_tool(
    tak_host: str = DEFAULT_TAK_HOST,
    tak_port: int = DEFAULT_TAK_PORT,
    tak_username: Optional[str] = None,
    tak_password: Optional[str] = None,
    agent_callsign: str = "SoldierIQ-Agent"
):
    """
    Create a tool for placing markers on TAK network

    Args:
        tak_host: TAK server hostname
        tak_port: TAK server port
        tak_username: Username for authentication (optional)
        tak_password: Password for authentication (optional)
        agent_callsign: Callsign prefix for agent

    Returns:
        Function: Agno tool for placing TAK markers
    """

    def place_tak_marker(
        latitude: float,
        longitude: float,
        callsign: str,
        message: Optional[str] = None,
        agent: Optional[Agent] = None
    ) -> dict:
        """
        Place a marker on the TAK network at specified coordinates.

        Use this when the user wants to mark a location, place a point of interest,
        or share coordinates with the team on TAK/ATAK.

        Args:
            latitude: Latitude coordinate (-90 to 90)
            longitude: Longitude coordinate (-180 to 180)
            callsign: Display name/label for the marker
            message: Optional message or remarks to attach to marker
            agent: Optional agent instance

        Returns:
            dict: Result with success status and details
        """
        try:
            # Validate coordinates
            if not (-90 <= latitude <= 90):
                return {
                    "success": False,
                    "error": f"Invalid latitude: {latitude} (must be -90 to 90)"
                }

            if not (-180 <= longitude <= 180):
                return {
                    "success": False,
                    "error": f"Invalid longitude: {longitude} (must be -180 to 180)"
                }

            logger.info(
                f"📍 Placing TAK marker: '{callsign}' at ({latitude}, {longitude})"
            )

            # Build CoT message
            cot_xml = CoTBuilder.build_marker(
                lat=latitude,
                lon=longitude,
                callsign=callsign,
                message=message
            )

            # Connect and send
            client = TAKClient(
                host=tak_host,
                port=tak_port,
                username=tak_username,
                password=tak_password
            )
            if not client.connect():
                return {
                    "success": False,
                    "error": f"Failed to connect to TAK server at {tak_host}:{tak_port}"
                }

            success = client.send_cot(cot_xml)
            client.disconnect()

            if success:
                logger.info(f"✅ TAK marker placed successfully: {callsign}")
                return {
                    "success": True,
                    "message": f"Marker '{callsign}' placed at {latitude}, {longitude}",
                    "coordinates": {"lat": latitude, "lon": longitude},
                    "callsign": callsign
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to send CoT message to TAK server"
                }

        except Exception as e:
            logger.error(f"❌ Failed to place TAK marker: {str(e)}")
            return {
                "success": False,
                "error": f"Exception: {str(e)}"
            }

    return place_tak_marker


def create_tak_chat_tool(
    tak_host: str = DEFAULT_TAK_HOST,
    tak_port: int = DEFAULT_TAK_PORT,
    tak_username: Optional[str] = None,
    tak_password: Optional[str] = None,
    agent_uid: str = "soldieriq-agent",
    agent_callsign: str = "SoldierIQ-Agent"
):
    """
    Create a tool for sending chat messages on TAK network

    Args:
        tak_host: TAK server hostname
        tak_port: TAK server port
        tak_username: Username for authentication (optional)
        tak_password: Password for authentication (optional)
        agent_uid: Unique ID for agent
        agent_callsign: Display name for agent

    Returns:
        Function: Agno tool for sending TAK chat messages
    """

    def send_tak_message(
        message: str,
        agent: Optional[Agent] = None
    ) -> dict:
        """
        Send a chat message to the TAK network (broadcast to all users).

        Use this when the user wants to broadcast a message or alert to
        all TAK users on the network.

        Args:
            message: Message text to send
            agent: Optional agent instance

        Returns:
            dict: Result with success status and details
        """
        try:
            if not message or not message.strip():
                return {
                    "success": False,
                    "error": "Message cannot be empty"
                }

            logger.info(f"💬 Sending TAK chat message: '{message[:50]}...'")

            # Build CoT chat message
            cot_xml = CoTBuilder.build_chat_message(
                sender_uid=agent_uid,
                sender_callsign=agent_callsign,
                message=message
            )

            # Connect and send
            client = TAKClient(
                host=tak_host,
                port=tak_port,
                username=tak_username,
                password=tak_password
            )
            if not client.connect():
                return {
                    "success": False,
                    "error": f"Failed to connect to TAK server at {tak_host}:{tak_port}"
                }

            success = client.send_cot(cot_xml)
            client.disconnect()

            if success:
                logger.info(f"✅ TAK message sent successfully")
                return {
                    "success": True,
                    "message": "Chat message sent to TAK network",
                    "sender": agent_callsign,
                    "text": message
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to send CoT message to TAK server"
                }

        except Exception as e:
            logger.error(f"❌ Failed to send TAK message: {str(e)}")
            return {
                "success": False,
                "error": f"Exception: {str(e)}"
            }

    return send_tak_message


def create_tak_route_tool(
    tak_host: str = DEFAULT_TAK_HOST,
    tak_port: int = DEFAULT_TAK_PORT,
    tak_username: Optional[str] = None,
    tak_password: Optional[str] = None
):
    """
    Create a tool for creating routes on TAK network

    Args:
        tak_host: TAK server hostname
        tak_port: TAK server port
        tak_username: Username for authentication (optional)
        tak_password: Password for authentication (optional)

    Returns:
        Function: Agno tool for creating TAK routes
    """

    def create_tak_route(
        waypoints: list[dict],
        route_name: str,
        agent: Optional[Agent] = None
    ) -> dict:
        """
        Create a route on the TAK network with multiple waypoints.

        Use this when the user wants to plan a route, show a path, or
        define a movement corridor with multiple points.

        Args:
            waypoints: List of waypoint dicts with 'lat' and 'lon' keys
                      Example: [{"lat": 37.7749, "lon": -122.4194}, {"lat": 37.8049, "lon": -122.4494}]
            route_name: Display name for the route
            agent: Optional agent instance

        Returns:
            dict: Result with success status and details
        """
        try:
            if not waypoints or len(waypoints) < 2:
                return {
                    "success": False,
                    "error": "Route must have at least 2 waypoints"
                }

            # Extract coordinates from waypoint dicts
            points = []
            for idx, wp in enumerate(waypoints):
                if "lat" not in wp or "lon" not in wp:
                    return {
                        "success": False,
                        "error": f"Waypoint {idx} missing 'lat' or 'lon' field"
                    }

                lat, lon = wp["lat"], wp["lon"]

                # Validate coordinates
                if not (-90 <= lat <= 90):
                    return {
                        "success": False,
                        "error": f"Invalid latitude at waypoint {idx}: {lat}"
                    }
                if not (-180 <= lon <= 180):
                    return {
                        "success": False,
                        "error": f"Invalid longitude at waypoint {idx}: {lon}"
                    }

                points.append((lat, lon))

            logger.info(f"🗺️ Creating TAK route: '{route_name}' with {len(points)} waypoints")

            # Build CoT messages for route
            cot_messages = CoTBuilder.build_route(
                points=points,
                route_name=route_name
            )

            # Connect to TAK server
            client = TAKClient(host=tak_host, port=tak_port)
            if not client.connect():
                return {
                    "success": False,
                    "error": f"Failed to connect to TAK server at {tak_host}:{tak_port}"
                }

            # Send all waypoint messages
            success = True
            for cot_xml in cot_messages:
                if not client.send_cot(cot_xml):
                    success = False
                    break

            client.disconnect()

            if success:
                logger.info(f"✅ TAK route created successfully: {route_name}")
                return {
                    "success": True,
                    "message": f"Route '{route_name}' created with {len(points)} waypoints",
                    "route_name": route_name,
                    "waypoint_count": len(points)
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to send route waypoints to TAK server"
                }

        except Exception as e:
            logger.error(f"❌ Failed to create TAK route: {str(e)}")
            return {
                "success": False,
                "error": f"Exception: {str(e)}"
            }

    return create_tak_route
