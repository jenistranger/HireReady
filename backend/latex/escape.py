"""LaTeX-safe escaping for user-supplied text.

XeLaTeX with fontspec handles UTF-8 (including Cyrillic and emoji) natively, so
we only need to escape the structural meta-characters that would otherwise break
the document or open a TeX-injection vector.
"""

import re

_REPLACEMENTS = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]

_URL_SAFE = re.compile(r"^[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$")


def latex_escape(value) -> str:
    if value is None:
        return ""
    s = str(value)
    for src, dst in _REPLACEMENTS:
        s = s.replace(src, dst)
    return s


def latex_url(value) -> str:
    """Escape a URL for use inside \\href{...}{...}. Returns empty string if
    the value doesn't look like a safe URL."""
    if not value:
        return ""
    s = str(value).strip()
    if not _URL_SAFE.match(s):
        return ""
    return s.replace("%", r"\%").replace("#", r"\#").replace("&", r"\&")
