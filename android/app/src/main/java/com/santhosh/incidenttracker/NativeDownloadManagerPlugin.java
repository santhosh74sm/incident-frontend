package com.santhosh.incidenttracker;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Base64InputStream;
import android.webkit.CookieManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.ByteArrayInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeDownloadManager")
public class NativeDownloadManagerPlugin extends Plugin {
    private static final int COPY_BUFFER_SIZE = 64 * 1024;

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String filename = call.getString("filename", "download");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String subdirectory = call.getString("subdirectory", "Incident Tracking System");

        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("File data is required.");
            return;
        }

        try {
            byte[] encodedBytes = base64Data.getBytes(StandardCharsets.US_ASCII);
            try (InputStream inputStream = new Base64InputStream(new ByteArrayInputStream(encodedBytes), Base64.DEFAULT)) {
                JSObject result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveStreamWithMediaStore(inputStream, filename, mimeType, subdirectory)
                    : saveLegacyStream(inputStream, filename, mimeType, subdirectory);
                call.resolve(result);
            }
        } catch (Exception error) {
            call.reject("Unable to save file to Downloads: " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void downloadUrl(PluginCall call) {
        String sourceUrl = call.getString("url");
        String filename = call.getString("filename", "download");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String subdirectory = call.getString("subdirectory", "Incident Tracking System");
        if (sourceUrl == null || sourceUrl.trim().isEmpty()) {
            call.reject("Download URL is required.");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            String resolvedMimeType = mimeType;
            try {
                connection = (HttpURLConnection) new URL(sourceUrl).openConnection();
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(120000);
                connection.setRequestProperty("Accept", "*/*");
                String cookies = CookieManager.getInstance().getCookie(sourceUrl);
                if (cookies != null && !cookies.isEmpty()) connection.setRequestProperty("Cookie", cookies);
                connection.connect();
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("Download failed with HTTP " + status + ".");
                String responseType = connection.getContentType();
                if (responseType != null && !responseType.trim().isEmpty()) resolvedMimeType = responseType.split(";")[0];
                try (InputStream inputStream = connection.getInputStream()) {
                    JSObject result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? saveStreamWithMediaStore(inputStream, filename, resolvedMimeType, subdirectory)
                        : saveLegacyStream(inputStream, filename, resolvedMimeType, subdirectory);
                    call.resolve(result);
                }
            } catch (Exception error) {
                call.reject("Unable to download file: " + error.getMessage(), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void copyStream(InputStream inputStream, OutputStream outputStream) throws Exception {
        byte[] buffer = new byte[COPY_BUFFER_SIZE];
        int read;
        while ((read = inputStream.read(buffer)) != -1) outputStream.write(buffer, 0, read);
        outputStream.flush();
    }

    private JSObject saveStreamWithMediaStore(InputStream inputStream, String filename, String mimeType, String subdirectory) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + File.separator + subdirectory);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
        if (uri == null) throw new IllegalStateException("MediaStore returned an empty URI.");
        try {
            try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                if (outputStream == null) throw new IllegalStateException("Unable to open MediaStore output stream.");
                copyStream(inputStream, outputStream);
            }
            ContentValues completed = new ContentValues();
            completed.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, completed, null, null);
            return buildResult(uri.toString(), "Downloads" + File.separator + subdirectory + File.separator + filename, filename, mimeType);
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            throw error;
        }
    }

    private JSObject saveLegacyStream(InputStream inputStream, String filename, String mimeType, String subdirectory) throws Exception {
        File targetDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), subdirectory);
        if (!targetDir.exists() && !targetDir.mkdirs()) throw new IllegalStateException("Unable to create Downloads folder.");
        File targetFile = new File(targetDir, filename);
        try {
            try (FileOutputStream outputStream = new FileOutputStream(targetFile)) {
                copyStream(inputStream, outputStream);
            }
            return buildResult(Uri.fromFile(targetFile).toString(), targetFile.getAbsolutePath(), filename, mimeType);
        } catch (Exception error) {
            if (targetFile.exists()) targetFile.delete();
            throw error;
        }
    }

    private JSObject buildResult(String uri, String path, String filename, String mimeType) {
        JSObject result = new JSObject();
        result.put("uri", uri);
        result.put("path", path);
        result.put("displayPath", path);
        result.put("filename", filename);
        result.put("mimeType", mimeType);
        result.put("native", true);
        result.put("public", true);
        return result;
    }

    private JSObject saveWithMediaStore(byte[] bytes, String filename, String mimeType, String subdirectory) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        String relativePath = Environment.DIRECTORY_DOWNLOADS + File.separator + subdirectory;

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri uri = resolver.insert(collection, values);

        if (uri == null) {
            throw new IllegalStateException("MediaStore returned an empty URI.");
        }

        try (OutputStream outputStream = resolver.openOutputStream(uri)) {
            if (outputStream == null) {
                throw new IllegalStateException("Unable to open MediaStore output stream.");
            }
            outputStream.write(bytes);
            outputStream.flush();
        }

        ContentValues completedValues = new ContentValues();
        completedValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, completedValues, null, null);

        String displayPath = "Downloads" + File.separator + subdirectory + File.separator + filename;
        JSObject result = new JSObject();
        result.put("uri", uri.toString());
        result.put("path", displayPath);
        result.put("displayPath", displayPath);
        result.put("filename", filename);
        result.put("mimeType", mimeType);
        result.put("native", true);
        result.put("public", true);
        return result;
    }

    private JSObject saveLegacy(byte[] bytes, String filename, String subdirectory) throws Exception {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File targetDir = new File(downloadsDir, subdirectory);
        if (!targetDir.exists() && !targetDir.mkdirs()) {
            throw new IllegalStateException("Unable to create Downloads folder.");
        }

        File targetFile = new File(targetDir, filename);
        try (FileOutputStream outputStream = new FileOutputStream(targetFile)) {
            outputStream.write(bytes);
            outputStream.flush();
        }

        JSObject result = new JSObject();
        result.put("uri", Uri.fromFile(targetFile).toString());
        result.put("path", targetFile.getAbsolutePath());
        result.put("displayPath", targetFile.getAbsolutePath());
        result.put("filename", filename);
        result.put("native", true);
        result.put("public", true);
        return result;
    }
}
