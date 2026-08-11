from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_rebuild_member_document'),
    ]

    operations = [
        # Remove DocumentReviewHistory table created by 0022
        migrations.DeleteModel(
            name='DocumentReviewHistory',
        ),
        # Remove old indexes referencing old fields
        migrations.AlterIndexTogether(
            name='memberdocument',
            index_together=set(),
        ),
    ]
