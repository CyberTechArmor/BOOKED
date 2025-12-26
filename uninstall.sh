#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default installation directory
INSTALL_DIR="/opt/booked"

print_banner() {
    echo -e "${RED}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║     ██████╗  ██████╗  ██████╗ ██╗  ██╗███████╗██████╗       ║"
    echo "║     ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗      ║"
    echo "║     ██████╔╝██║   ██║██║   ██║█████╔╝ █████╗  ██║  ██║      ║"
    echo "║     ██╔══██╗██║   ██║██║   ██║██╔═██╗ ██╔══╝  ██║  ██║      ║"
    echo "║     ██████╔╝╚██████╔╝╚██████╔╝██║  ██╗███████╗██████╔╝      ║"
    echo "║     ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝       ║"
    echo "║                                                              ║"
    echo "║                    UNINSTALL SCRIPT                          ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
parse_args() {
    REMOVE_DATA=false
    REMOVE_IMAGES=false
    FORCE=false
    CUSTOM_DIR=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --remove-data)
                REMOVE_DATA=true
                shift
                ;;
            --remove-images)
                REMOVE_IMAGES=true
                shift
                ;;
            --force|-f)
                FORCE=true
                shift
                ;;
            --dir|-d)
                CUSTOM_DIR="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    if [[ -n "$CUSTOM_DIR" ]]; then
        INSTALL_DIR="$CUSTOM_DIR"
    fi
}

show_help() {
    echo "BOOKED Uninstall Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIR        Specify installation directory (default: /opt/booked)"
    echo "  --remove-data        Remove all data including database volumes"
    echo "  --remove-images      Remove Docker images"
    echo "  -f, --force          Skip confirmation prompts"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                           # Interactive uninstall"
    echo "  $0 --remove-data             # Remove including all data"
    echo "  $0 --force --remove-data     # Force remove everything"
    echo "  $0 --dir /custom/path        # Uninstall from custom location"
}

# Check if installation exists
check_installation() {
    if [[ ! -d "$INSTALL_DIR" ]]; then
        log_error "Installation directory not found: $INSTALL_DIR"
        echo ""
        echo "Please specify the correct installation directory using --dir"
        exit 1
    fi

    if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
        log_warning "docker-compose.yml not found in $INSTALL_DIR"
        log_warning "This may not be a valid BOOKED installation"

        if [[ "$FORCE" != true ]]; then
            read -p "Continue anyway? [y/N]: " CONTINUE
            if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
                log_info "Uninstall cancelled"
                exit 0
            fi
        fi
    fi
}

# Confirm uninstall
confirm_uninstall() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi

    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}                    UNINSTALL CONFIRMATION                      ${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Installation Directory: $INSTALL_DIR"
    echo ""
    echo "  Actions to be performed:"
    echo "    - Stop all BOOKED containers"
    echo "    - Remove BOOKED containers"
    if [[ "$REMOVE_DATA" == true ]]; then
        echo -e "    - ${RED}Remove all data volumes (DATABASE WILL BE DELETED!)${NC}"
    fi
    if [[ "$REMOVE_IMAGES" == true ]]; then
        echo "    - Remove Docker images"
    fi
    echo "    - Remove installation directory"
    echo ""

    if [[ "$REMOVE_DATA" == true ]]; then
        echo -e "${RED}⚠️  WARNING: This will permanently delete all your data!${NC}"
        echo ""
        read -p "Type 'DELETE' to confirm: " CONFIRM_DELETE
        if [[ "$CONFIRM_DELETE" != "DELETE" ]]; then
            log_info "Uninstall cancelled"
            exit 0
        fi
    else
        read -p "Proceed with uninstall? [y/N]: " CONFIRM
        if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
            log_info "Uninstall cancelled"
            exit 0
        fi
    fi
}

# Stop and remove containers
stop_containers() {
    log_info "Stopping BOOKED services..."

    cd "$INSTALL_DIR" 2>/dev/null || true

    # Try to detect which compose files were used
    COMPOSE_FILES="-f docker-compose.yml"

    if [[ -f "docker-compose.nginx.yml" ]]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.nginx.yml"
    elif [[ -f "docker-compose.traefik.yml" ]]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.traefik.yml"
    elif [[ -f "docker-compose.caddy.yml" ]]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.caddy.yml"
    elif [[ -f "docker-compose.external-proxy.yml" ]]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.external-proxy.yml"
    fi

    # Stop containers
    if [[ "$REMOVE_DATA" == true ]]; then
        docker compose $COMPOSE_FILES down -v 2>/dev/null || docker-compose $COMPOSE_FILES down -v 2>/dev/null || true
    else
        docker compose $COMPOSE_FILES down 2>/dev/null || docker-compose $COMPOSE_FILES down 2>/dev/null || true
    fi

    log_success "Containers stopped and removed"
}

# Remove Docker images
remove_images() {
    if [[ "$REMOVE_IMAGES" != true ]]; then
        return 0
    fi

    log_info "Removing Docker images..."

    # Remove images built for this project
    docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^booked' | while read image; do
        log_info "Removing image: $image"
        docker rmi "$image" 2>/dev/null || true
    done

    # Prune dangling images
    docker image prune -f 2>/dev/null || true

    log_success "Docker images removed"
}

# Remove installation directory
remove_directory() {
    log_info "Removing installation directory..."

    # Backup credentials file if it exists and we're not doing a full remove
    if [[ -f "$INSTALL_DIR/.credentials" && "$REMOVE_DATA" != true ]]; then
        BACKUP_FILE="/tmp/booked-credentials-$(date +%Y%m%d%H%M%S).txt"
        cp "$INSTALL_DIR/.credentials" "$BACKUP_FILE"
        log_warning "Credentials backed up to: $BACKUP_FILE"
    fi

    # Remove directory
    if [[ -d "$INSTALL_DIR" ]]; then
        sudo rm -rf "$INSTALL_DIR"
        log_success "Installation directory removed"
    fi
}

# Remove Docker volumes (if not already done)
remove_volumes() {
    if [[ "$REMOVE_DATA" != true ]]; then
        return 0
    fi

    log_info "Checking for remaining Docker volumes..."

    # Remove any volumes that might still exist
    docker volume ls --format '{{.Name}}' | grep -E 'booked' | while read volume; do
        log_info "Removing volume: $volume"
        docker volume rm "$volume" 2>/dev/null || true
    done

    log_success "Docker volumes cleaned up"
}

# Remove Docker networks
remove_networks() {
    log_info "Cleaning up Docker networks..."

    docker network ls --format '{{.Name}}' | grep -E 'booked' | while read network; do
        log_info "Removing network: $network"
        docker network rm "$network" 2>/dev/null || true
    done

    log_success "Docker networks cleaned up"
}

# Print completion message
print_completion() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}              BOOKED UNINSTALL COMPLETE!                        ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  The following actions were completed:"
    echo "    ✓ BOOKED containers stopped and removed"
    if [[ "$REMOVE_DATA" == true ]]; then
        echo "    ✓ Data volumes removed"
    else
        echo "    - Data volumes preserved (use --remove-data to remove)"
    fi
    if [[ "$REMOVE_IMAGES" == true ]]; then
        echo "    ✓ Docker images removed"
    fi
    echo "    ✓ Installation directory removed"
    echo "    ✓ Docker networks cleaned up"
    echo ""

    if [[ "$REMOVE_DATA" != true ]]; then
        echo -e "${YELLOW}Note:${NC} Database volumes may still exist. To remove them, run:"
        echo "  docker volume ls | grep booked"
        echo "  docker volume rm <volume_name>"
        echo ""
    fi

    echo "Thank you for using BOOKED!"
    echo ""
}

# Main function
main() {
    print_banner
    parse_args "$@"
    check_installation
    confirm_uninstall
    stop_containers
    remove_images
    remove_directory
    remove_volumes
    remove_networks
    print_completion
}

# Run main function
main "$@"
