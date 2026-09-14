mod wire;

pub use wire::*;

#[cfg(test)]
mod bridge_fixture_tests {
    use super::*;

    #[test]
    fn protocol_version_matches_reviewed_herdr_v090_snapshot() {
        assert_eq!(PROTOCOL_VERSION, 22);
    }

    #[test]
    fn client_terminal_hello_wire_fixture_matches_reviewed_snapshot() {
        let msg = ClientMessage::TerminalHello {
            version: PROTOCOL_VERSION,
            cols: 80,
            rows: 24,
            cell_width_px: 8,
            cell_height_px: 16,
            pixel_mouse: true,
        };
        let mut frame = Vec::new();
        write_message(&mut frame, &msg).unwrap();
        let decoded: ClientMessage = read_message(&mut frame.as_slice(), MAX_FRAME_SIZE).unwrap();
        assert_eq!(decoded, msg);
        assert_eq!(frame.len(), 11);
    }

    #[test]
    fn server_welcome_wire_fixture_matches_reviewed_snapshot() {
        let msg = ServerMessage::Welcome {
            version: PROTOCOL_VERSION,
            encoding: RenderEncoding::TerminalAnsi,
            error: None,
        };
        let mut frame = Vec::new();
        write_message(&mut frame, &msg).unwrap();
        let decoded: ServerMessage = read_message(&mut frame.as_slice(), MAX_FRAME_SIZE).unwrap();
        assert_eq!(decoded, msg);
        assert_eq!(frame, vec![4, 0, 0, 0, 0, 22, 1, 0]);
    }
}
