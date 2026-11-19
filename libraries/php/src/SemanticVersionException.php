<?php

declare(strict_types=1);

namespace Vlt\SemanticVersions;

/** Thrown for input that is not a version or not a range. */
final class SemanticVersionException extends \InvalidArgumentException
{
}
