package com.santhosh.incidenttracker;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeDownloadManager")
public class NativeDownloadManagerPlugin extends Plugin {
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
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            JSObject result;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                result = saveWithMediaStore(bytes, filename, mimeType, subdirectory);
            } else {
                result = saveLegacy(bytes, filename, subdirectory);
            }

            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to save file to Downloads: " + error.getMessage(), error);
        }
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
