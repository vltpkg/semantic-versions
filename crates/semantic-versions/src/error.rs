use std::fmt;

/// Why a version or range failed to parse.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// The input is longer than [`MAX_LENGTH`](crate::MAX_LENGTH).
    TooLong,
    /// The input is not a valid version.
    InvalidVersion(String),
    /// A numeric identifier exceeds [`MAX_SAFE_INTEGER`](crate::MAX_SAFE_INTEGER).
    TooLarge(String),
    /// The input is not a valid range.
    InvalidRange(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::TooLong => write!(f, "input is longer than {} characters", crate::MAX_LENGTH),
            Error::InvalidVersion(s) => write!(f, "invalid version: {s}"),
            Error::TooLarge(s) => write!(f, "numeric identifier is too large: {s}"),
            Error::InvalidRange(s) => write!(f, "invalid range: {s}"),
        }
    }
}

impl std::error::Error for Error {}
