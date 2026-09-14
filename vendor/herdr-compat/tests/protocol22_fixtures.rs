use std::fmt::Debug;

use herdr_compat::protocol::{
    read_message, write_message, ClientMessage, FramingError, RenderEncoding, ServerMessage,
    MAX_FRAME_SIZE, PROTOCOL_VERSION,
};
use serde::{de::DeserializeOwned, Serialize};

fn fixture(name: &str) -> Vec<u8> {
    include_str!("fixtures/protocol22-frames.hex")
        .lines()
        .filter_map(|line| line.strip_prefix(&format!("{name}=")))
        .next()
        .unwrap_or_else(|| panic!("missing protocol22 fixture {name}"))
        .as_bytes()
        .chunks(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect()
}

fn assert_frame<T>(name: &str, message: T)
where
    T: Serialize + DeserializeOwned + PartialEq + Debug,
{
    let expected = fixture(name);
    let mut encoded = Vec::new();
    write_message(&mut encoded, &message).unwrap();
    assert_eq!(
        encoded, expected,
        "frozen protocol-22 frame changed: {name}"
    );
    let decoded: T = read_message(&mut expected.as_slice(), MAX_FRAME_SIZE).unwrap();
    assert_eq!(decoded, message);
}

#[test]
fn protocol22_frozen_frames_cover_terminal_attach_wire_shape() {
    assert_eq!(PROTOCOL_VERSION, 22);
    assert_frame(
        "terminal_hello",
        ClientMessage::TerminalHello {
            version: PROTOCOL_VERSION,
            cols: 80,
            rows: 24,
            cell_width_px: 0,
            cell_height_px: 0,
            pixel_mouse: false,
        },
    );
    assert_frame(
        "welcome",
        ServerMessage::Welcome {
            version: PROTOCOL_VERSION,
            encoding: RenderEncoding::TerminalAnsi,
            error: None,
        },
    );
    assert_frame(
        "mouse_capture",
        ServerMessage::MouseCapture {
            enabled: true,
            sgr_pixels: true,
        },
    );
    assert_frame("terminal_bell", ServerMessage::TerminalBell { count: 3 });
    assert_frame(
        "graphics_transmission_started",
        ClientMessage::GraphicsTransmissionStarted {
            transfer_id: 7,
            image_id: 42,
        },
    );
    assert_frame(
        "graphics_transmission_result",
        ClientMessage::GraphicsTransmissionResult {
            transfer_id: 7,
            image_id: 42,
            success: true,
        },
    );
    assert_frame(
        "graphics_file",
        ServerMessage::GraphicsFile {
            path: "/tmp/frame".into(),
            expected_len: 4,
            image_id: 42,
            transfer_id: 7,
            leading: b"\x1b[2;3H".to_vec(),
            control: "a=T,f=32,i=42,q=0".into(),
            surface_asset: None,
        },
    );
    assert_frame(
        "graphics_transmission_retired",
        ServerMessage::GraphicsTransmissionRetired {
            transfer_id: 7,
            image_id: 42,
        },
    );
}

#[test]
fn protocol22_enum_discriminants_keep_terminal_attach_after_direct_graphics_mode() {
    let hello = ClientMessage::TerminalHello {
        version: PROTOCOL_VERSION,
        cols: 80,
        rows: 24,
        cell_width_px: 0,
        cell_height_px: 0,
        pixel_mouse: false,
    };
    let payload = bincode::serde::encode_to_vec(&hello, bincode::config::standard()).unwrap();
    assert_eq!(payload, [0, 22, 80, 24, 0, 0, 0]);

    let client_shell_hello = bincode::serde::encode_to_vec(
        &ClientMessage::ClientShellHello {
            version: PROTOCOL_VERSION,
            cell_width_px: 0,
            cell_height_px: 0,
            surface_size: herdr_compat::protocol::ClientSurfaceSize { cols: 80, rows: 24 },
            pixel_mouse: false,
            direct_graphics: true,
            endpoint_keybindings: false,
            mouse_capture: false,
        },
        bincode::config::standard(),
    )
    .unwrap();
    assert_eq!(client_shell_hello.first().copied(), Some(11));
}

#[test]
fn protocol22_fixture_reader_rejects_trailing_payload_bytes() {
    let mut frame = fixture("welcome");
    frame[0] += 1;
    frame.push(0);
    let error =
        read_message::<_, ServerMessage>(&mut frame.as_slice(), MAX_FRAME_SIZE).unwrap_err();
    assert!(matches!(error, FramingError::Bincode(_)));
}
