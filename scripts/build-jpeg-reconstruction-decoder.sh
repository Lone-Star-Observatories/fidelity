#!/bin/bash
# Rebuild the pinned single-threaded decoder in a NEW disposable work directory.
# Supply an already installed official emsdk checkout at the pinned commit/version.
set -euo pipefail
work=${1:?Usage: build-jpeg-reconstruction-decoder.sh NEW_WORK_DIR EMSDK_ROOT}
sdk=${2:?Supply the pinned emsdk root}
repo=$(cd "$(dirname "$0")/.." && pwd)
if [ -e "$work" ]; then echo 'Work directory must not already exist.' >&2; exit 1; fi
if [ "$(git -C "$sdk" rev-parse HEAD)" != 3b3963d86a5c97adaf6eaa845cdfe0b811c2f960 ]; then echo 'Unexpected emsdk source commit.' >&2; exit 1; fi
source "$sdk/emsdk_env.sh"
case "$(emcc --version)" in *3.1.73*) ;; *) echo 'Emscripten3.1.73 is required.' >&2; exit 1;; esac
mkdir -p "$work"
work=$(cd "$work" && pwd)
git clone --branch v0.11.1 --depth 1 --recurse-submodules --shallow-submodules https://github.com/libjxl/libjxl.git "$work/libjxl"
if [ "$(git -C "$work/libjxl" rev-parse HEAD)" != 794a5dcf0d54f9f0b20d288a12e87afb91d20dfc ]; then echo 'Unexpected libjxl source commit.' >&2; exit 1; fi
cp "$repo/src/vendor/jpeg-xl/reconstruct.c" "$work/reconstruct.c"
cat >> "$work/libjxl/CMakeLists.txt" <<'CMAKE'
add_executable(fidelity_reconstruct ../reconstruct.c)
target_link_libraries(fidelity_reconstruct PRIVATE jxl_dec)
set_target_properties(fidelity_reconstruct PROPERTIES SUFFIX ".mjs")
target_link_options(fidelity_reconstruct PRIVATE "-Oz" "--no-entry" "-sMODULARIZE=1" "-sEXPORT_ES6=1" "-sENVIRONMENT=web,node" "-sALLOW_MEMORY_GROWTH=1" "-sFILESYSTEM=0" "-sEXPORTED_FUNCTIONS=['_reconstruct','_malloc','_free']")
CMAKE
emcmake cmake -S "$work/libjxl" -B "$work/wasm-build" -G Ninja \
 -DCMAKE_BUILD_TYPE=MinSizeRel -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF \
 -DJPEGXL_ENABLE_TOOLS=OFF -DJPEGXL_ENABLE_JPEGLI=OFF -DJPEGXL_ENABLE_DOXYGEN=OFF \
 -DJPEGXL_ENABLE_MANPAGES=OFF -DJPEGXL_ENABLE_BENCHMARK=OFF -DJPEGXL_ENABLE_EXAMPLES=OFF \
 -DJPEGXL_ENABLE_JNI=OFF -DJPEGXL_ENABLE_SJPEG=OFF -DJPEGXL_ENABLE_OPENEXR=OFF \
 -DJPEGXL_ENABLE_SKCMS=ON -DJPEGXL_ENABLE_TCMALLOC=OFF -DJPEGXL_ENABLE_WASM_THREADS=OFF
cmake --build "$work/wasm-build" --target fidelity_reconstruct -j4
# Do not replace the vendored binary automatically. Compare hashes against its
# manifest and run exact original-JPEG reconstruction tests before updating it.
