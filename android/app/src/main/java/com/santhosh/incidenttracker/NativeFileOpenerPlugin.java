package com.santhosh.incidenttracker;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "NativeFileOpener")
public class NativeFileOpenerPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String uriValue = call.getString("uri");
        String mimeType = call.getString("mimeType", "*/*");

        if (uriValue == null || uriValue.trim().isEmpty()) {
            call.reject("File URI is required.");
            return;
        }

        try {
            Uri uri = Uri.parse(uriValue);
            if ("file".equalsIgnoreCase(uri.getScheme())) {
                uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    new File(uri.getPath())
                );
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);

            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("No installed app can open this file type.", error);
        } catch (Exception error) {
            call.reject("Unable to open file.", error);
        }
    }
}
